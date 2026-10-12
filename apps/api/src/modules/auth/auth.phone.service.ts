/**
 * Connexion et inscription par téléphone + code SMS (P2.2, spec §4.3 à §4.5).
 *
 * Anti-énumération : la demande de code ne lit JAMAIS `iam.users` (réponse, écritures et temps identiques que le
 * numéro ait un compte ou non). Le code est haché avec sel + HMAC(pepper) ; seule la boîte du fournisseur le voit.
 * Aucune donnée personnelle dans les journaux : ni numéro, ni code, ni jeton.
 */
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { normalizePhone, type PhoneCountry } from '@cp/shared'
import type { AuthResponse } from '@cp/shared/auth-schemas'
import { getEnv } from '../../env.js'
import { AppError } from '../../lib/errors.js'
import { createLogger, type Logger } from '../../logger.js'
import { consumeLimit } from '../../middlewares/rate-limit.js'
import { getPhoneConfig, OTP_TTL_SECONDS } from './auth.phone.config.js'
import { defaultOrgName, otpSmsText } from './auth.phone.messages.js'
import * as repo from './auth.phone.repository.js'
import { toMeResponse, toSessionResponse } from './auth.resource.js'
import { generateSessionToken } from './auth.token.js'
import { getSmsProvider } from './sms/sms.factory.js'

const PURPOSE = 'otp_login'
const SMS_TIMEOUT_MS = 5000
/** Plancher de réponse d'une demande de code (ms) + gigue : le temps ne dépend pas du chemin suivi. */
const RESPONSE_FLOOR_MS = 300
const RESPONSE_JITTER_MS = 60

let logger: Logger | undefined
const log = (): Logger => {
  logger ??= createLogger()
  return logger
}

/** Clé de limite par numéro : HMAC-SHA256(pepper, e164) en hexadécimal — jamais le numéro, jamais un sha256 brut. */
export function phoneLimitKey(e164: string, pepper: string): string {
  return createHmac('sha256', pepper).update(e164).digest('hex')
}

/** `token_hash` = sel(16) ‖ HMAC-SHA256(pepper, sel ‖ purpose ‖ e164 ‖ code) : 48 octets, unique grâce au sel. */
function otpMac(pepper: string, salt: Buffer, e164: string, code: string): Buffer {
  return createHmac('sha256', pepper)
    .update(Buffer.concat([salt, Buffer.from(PURPOSE), Buffer.from(e164), Buffer.from(code)]))
    .digest()
}

function generateOtp(e164: string, pepper: string): { code: string; tokenHash: Buffer } {
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
  const salt = randomBytes(16)
  return { code, tokenHash: Buffer.concat([salt, otpMac(pepper, salt, e164, code)]) }
}

function codeMatches(pepper: string, e164: string, code: string, stored: Buffer): boolean {
  if (stored.length !== 48) return false
  const expected = otpMac(pepper, stored.subarray(0, 16), e164, code)
  return timingSafeEqual(expected, stored.subarray(16))
}

/** Normalise le numéro ; sinon 422 avec la raison structurée, sans jamais renvoyer la saisie. */
function normalizeOrThrow(phone: string, country: PhoneCountry) {
  const result = normalizePhone(phone, country)
  if (!result.ok) {
    throw new AppError('PLATFORM_VALIDATION_ERROR', {
      field: 'phone',
      reason: result.reason,
      ...(result.expectedLength === undefined ? {} : { expected_length: result.expectedLength }),
    })
  }
  return result
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// ── Demande de code ──

export async function requestPhoneCode(params: {
  phone: string
  country: PhoneCountry
  locale: 'fr' | 'en'
  ip: string | null
  userAgent: string | null
}): Promise<{ expiresInSeconds: number; resendAfterSeconds: number }> {
  const startedAt = performance.now()
  const cfg = getPhoneConfig()
  const pepper = getEnv().OTP_PEPPER

  const { e164, country } = normalizeOrThrow(params.phone, params.country)
  const rules = await repo.getCountryRules(country)
  if (!rules?.isActive) {
    throw new AppError('PLATFORM_VALIDATION_ERROR', {
      field: 'phone',
      reason: 'COUNTRY_NOT_SUPPORTED',
    })
  }

  // Indisponibilité globale (aucun fournisseur) : vérifiée AVANT les quotas par numéro, pour ne pas consommer
  // le délai de renvoi d'une personne que nous ne pouvons de toute façon pas servir. Indépendant du compte.
  const provider = getSmsProvider()
  if (!provider.isAvailable()) throw new AppError('AUTH_SMS_UNAVAILABLE')

  const key = phoneLimitKey(e164, pepper)
  if (cfg.resendDelaySeconds > 0) {
    await consumeLimit(
      { keyPrefix: 'rl:auth:otp:req:phone', points: 1, duration: cfg.resendDelaySeconds },
      key,
    )
  }
  await consumeLimit(
    { keyPrefix: 'rl:auth:otp:req:phone:h', points: cfg.requestPerPhonePerHour, duration: 3600 },
    key,
  )

  const blocked = await repo.isBlocked({ phone: e164, ip: params.ip })
  const { code, tokenHash } = generateOtp(e164, pepper)
  await repo.issueOtpToken({ target: e164, tokenHash, ip: params.ip })

  if (!blocked) await sendOrCompensate(provider, e164, otpSmsText(code, params.locale))

  const floor = RESPONSE_FLOOR_MS + Math.random() * RESPONSE_JITTER_MS
  await sleep(Math.max(0, floor - (performance.now() - startedAt)))
  return { expiresInSeconds: OTP_TTL_SECONDS, resendAfterSeconds: cfg.resendDelaySeconds }
}

async function sendOrCompensate(
  provider: ReturnType<typeof getSmsProvider>,
  e164: string,
  text: string,
): Promise<void> {
  try {
    await provider.send({ to: e164, text, signal: AbortSignal.timeout(SMS_TIMEOUT_MS) })
  } catch (err) {
    // Aucun message du fournisseur (il peut contenir le numéro) : son nom et le type d'erreur suffisent.
    log().warn({ provider: provider.name, error_name: (err as Error)?.name }, 'SMS send failed')
    await repo.expireOtpTokens(e164).catch(() => {
      log().error({ provider: provider.name }, 'OTP compensation failed')
    })
    throw new AppError('AUTH_SMS_UNAVAILABLE')
  }
}

// ── Vérification du code ──

function isPhoneUniqueViolation(err: unknown): boolean {
  const pg = err as { code?: string; constraint_name?: string; constraint?: string }
  return pg?.code === '23505' && (pg.constraint_name ?? pg.constraint) === 'users_phone_e164_key'
}

/** Une seule nouvelle tentative : la course sur `users_phone_e164_key` se résout en connexion au compte existant. */
async function verifyWithRetry(args: repo.VerifyOtpParams): Promise<repo.VerifyOtpOutcome> {
  try {
    return await repo.verifyOtpTx(args)
  } catch (err) {
    if (!isPhoneUniqueViolation(err)) throw err
    return repo.verifyOtpTx(args)
  }
}

export async function verifyPhoneCode(params: {
  phone: string
  country: PhoneCountry
  code: string
  fullName?: string | undefined
  rememberMe: boolean
  locale: 'fr' | 'en'
  ip: string | null
  userAgent: string | null
}): Promise<{ authResponse: AuthResponse; isNewUser: boolean; token: string; maxAge: number }> {
  const cfg = getPhoneConfig()
  const env = getEnv()

  const { e164, country } = normalizeOrThrow(params.phone, params.country)
  await consumeLimit(
    {
      keyPrefix: 'rl:auth:otp:verify:phone',
      points: cfg.verifyPerPhone,
      duration: cfg.windowSeconds,
    },
    phoneLimitKey(e164, env.OTP_PEPPER),
  )
  // Bloqué entre la demande et la vérification : même réponse qu'un code faux, sans compteur d'essais.
  if (await repo.isBlocked({ phone: e164, ip: params.ip })) throw new AppError('AUTH_OTP_INVALID')

  const maxAge = params.rememberMe
    ? env.SESSION_REMEMBER_MAX_AGE_SECONDS
    : env.SESSION_MAX_AGE_SECONDS
  const session = generateSessionToken()
  const fullName = params.fullName ?? null
  const outcome = await verifyWithRetry({
    e164,
    country,
    codeMatches: (stored) => codeMatches(env.OTP_PEPPER, e164, params.code, stored),
    fullName,
    orgName: fullName ?? defaultOrgName(params.locale),
    locale: params.locale,
    dataRegionCode: cfg.dataRegionCode,
    session: { tokenHash: session.hash, expiresAt: new Date(Date.now() + maxAge * 1000) },
    ip: params.ip,
    userAgent: params.userAgent,
  })

  // Les erreurs sont levées ICI, après le commit de la transaction (l'incrément d'essais est déjà validé).
  switch (outcome.kind) {
    case 'invalid':
      throw new AppError(
        'AUTH_OTP_INVALID',
        outcome.remainingAttempts === undefined
          ? undefined
          : { remaining_attempts: outcome.remainingAttempts },
      )
    case 'expired':
      throw new AppError('AUTH_OTP_EXPIRED')
    case 'exceeded':
      throw new AppError('AUTH_OTP_ATTEMPTS_EXCEEDED')
    case 'suspended':
      throw new AppError('AUTH_ACCOUNT_SUSPENDED')
    case 'signup_closed':
      throw new AppError('AUTH_SIGNUP_CLOSED')
    case 'ok': {
      const now = new Date().toISOString()
      return {
        authResponse: {
          // Numéro vérifié ⇒ éligible quelle que soit la valeur du paramètre (règle D59, spec §4.4).
          user: toMeResponse({ ...outcome.user, freeTierEligible: true }),
          session: toSessionResponse(
            {
              publicId: outcome.session.publicId,
              ip: params.ip,
              userAgent: params.userAgent,
              deviceLabel: null,
              createdAt: now,
              lastSeenAt: now,
            },
            outcome.session.id,
            outcome.session.id,
          ),
        },
        isNewUser: outcome.isNewUser,
        token: session.token,
        maxAge,
      }
    }
  }
}
