/**
 * Connexion, inscription, liaison et déliaison Google (P2.3, spec §3.3 et P-1/P-2, D67).
 *
 * Règles : jamais de rattachement automatique (un e-mail connu crée une liaison EN ATTENTE, confirmée après une connexion
 * au compte) ; jetons Google jamais conservés ni journalisés ; aucun appel réseau dans une transaction ; un seul appel au
 * point de jeton (pas de relance). Les journaux ne portent que le `public_id` de l'utilisateur.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { safeNextPath } from '@cp/shared'
import type { ErrorCode } from '@cp/shared/errors'
import type { AuthContext } from '../../../context.js'
import { getEnv } from '../../../env.js'
import { AppError } from '../../../lib/errors.js'
import { createLogger, type Logger } from '../../../logger.js'
import { consumeLimit } from '../../../middlewares/rate-limit.js'
import { sendIdentityLinkedEmail, sendIdentityUnlinkedEmail } from '../auth.email.js'
import { defaultOrgName } from '../auth.phone.messages.js'
import { findSessionByTokenHash, findUserById } from '../auth.repository.js'
import { generateSessionToken, hashToken } from '../auth.token.js'
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleCode,
  type GoogleOAuthConfig,
  getGoogleConfig,
} from './google.client.js'
import { evaluateGoogleEmail, verifyGoogleIdToken } from './google.id-token.js'
import {
  consumeFlow,
  consumePendingLink,
  type OauthFlow,
  peekPendingLink,
  randomToken,
  saveFlow,
  savePendingLink,
} from './oauth.flow.js'
import * as repo from './oauth.repository.js'

/** Fraîcheur exigée d'une session pour lier ou délier (P-1, secondes). */
export const REAUTH_MAX_AGE_SECONDS = 600
const MAX_CODE_LENGTH = 2048
const MAX_STATE_LENGTH = 128

let logger: Logger | undefined
const log = (): Logger => {
  logger ??= createLogger()
  return logger
}

/** Compare par `code` (et non `instanceof`) : robuste à une double instanciation du module en test. */
export function isAppError(err: unknown): err is AppError {
  return (
    err instanceof AppError ||
    (err instanceof Error && err.name === 'AppError' && typeof (err as AppError).code === 'string')
  )
}

function securityEvent(event: string, userPublicId: string): void {
  log().info({ event, user: userPublicId, provider: 'google' }, 'security_event')
}

/** Alerte e-mail sans attente ; l'échec est journalisé sans adresse ni message du transport. */
function alert(kind: 'linked' | 'unlinked', user: repo.LockedUser): void {
  if (!user.email || !user.emailVerifiedAt) return
  const send = kind === 'linked' ? sendIdentityLinkedEmail : sendIdentityUnlinkedEmail
  void send(user.email, user.locale).catch((err: unknown) => {
    log().warn({ error_name: (err as Error)?.name, kind }, 'identity alert email failed')
  })
}

const normalizeLocale = (v: unknown): 'fr' | 'en' => (v === 'en' ? 'en' : 'fr')

/** Clé de limite par utilisateur : HMAC(pepper, domaine ‖ id interne) — jamais l'identifiant en clair. */
function userLimitKey(userId: bigint): string {
  return createHmac('sha256', getEnv().OTP_PEPPER).update(`auth:social:${userId}`).digest('hex')
}

const constantTimeEquals = (a: string, b: string): boolean => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export const maskEmail = (email: string): string => {
  const [local = '', domain = ''] = email.split('@')
  return `${local.slice(0, 1)}***@${domain}`
}

function requireConfig(): GoogleOAuthConfig {
  const config = getGoogleConfig()
  if (!config) throw new AppError('AUTH_SOCIAL_PROVIDER_UNAVAILABLE', { reason: 'not_configured' })
  return config
}

async function createFlow(
  config: GoogleOAuthConfig,
  data: Omit<OauthFlow, 'state' | 'nonce' | 'code_verifier' | 'created_at'>,
): Promise<{ url: string; cookie: string }> {
  const { generateCodeVerifier } = await import('arctic')
  const flow: OauthFlow = {
    ...data,
    state: randomToken(),
    nonce: randomToken(),
    code_verifier: generateCodeVerifier(),
    created_at: Date.now(),
  }
  const cookie = randomToken()
  await saveFlow(cookie, flow)
  const url = buildGoogleAuthorizationUrl(config, {
    state: flow.state,
    nonce: flow.nonce,
    codeVerifier: flow.code_verifier,
  })
  return { url: url.toString(), cookie }
}

// ── Démarrage ──

export async function startGoogleLogin(p: {
  next?: string | undefined
  rememberMe?: string | undefined
  locale?: string | undefined
}) {
  const config = requireConfig()
  return createFlow(config, {
    intent: 'login',
    next: safeNextPath(p.next),
    remember_me: p.rememberMe !== 'false',
    locale: normalizeLocale(p.locale),
  })
}

/** Ordre : compte vérifié → fraîcheur → limite utilisateur → action. (La session est vérifiée par `requireAuth`.) */
export async function startGoogleLink(auth: AuthContext, next: string | undefined) {
  const user = await findUserById(auth.userId)
  if (!user) throw new AppError('AUTH_TOKEN_INVALID')
  assertVerified({ email: user.email, emailVerifiedAt: user.emailVerifiedAt, status: user.status })
  assertFresh(auth.sessionCreatedAt)
  await consumeLimit(
    { keyPrefix: 'rl:auth:social:link', points: 10, duration: 3600 },
    userLimitKey(auth.userId),
  )
  const config = requireConfig()
  const locale = normalizeLocale(user.locale)
  const id = await repo.inTransaction(null, (tx) => repo.hasGoogleIdentity(tx, auth.userId))
  if (id) throw new AppError('AUTH_IDENTITY_ALREADY_LINKED', { reason: 'provider_already_linked' })
  return createFlow(config, {
    intent: 'link',
    user_id: auth.userId.toString(),
    session_id: auth.sessionId.toString(),
    next: safeNextPath(next, '/account/security'),
    remember_me: true,
    locale,
  })
}

function assertVerified(u: {
  email: string | null
  emailVerifiedAt: string | null
  status: string
}): void {
  if (u.email === null)
    throw new AppError('AUTH_ACCOUNT_NOT_VERIFIED', { reason: 'email_required' })
  if (u.status !== 'active' || u.emailVerifiedAt === null) {
    throw new AppError('AUTH_ACCOUNT_NOT_VERIFIED', { reason: 'pending' })
  }
}

function assertFresh(sessionCreatedAt: string): void {
  const ageMs = Date.now() - new Date(sessionCreatedAt).getTime()
  if (!(ageMs <= REAUTH_MAX_AGE_SECONDS * 1000)) {
    throw new AppError('AUTH_REAUTH_REQUIRED', {
      reason: 'recent_login_required',
      max_age_seconds: REAUTH_MAX_AGE_SECONDS,
    })
  }
}

// ── Rappel ──

export type CallbackOutcome =
  | { kind: 'session'; token: string; maxAge: number; next: string }
  | { kind: 'pending_link'; linkCookie: string }
  | { kind: 'linked'; next: string }
  | {
      kind: 'error'
      code: ErrorCode
      reason?: string
      intent: 'login' | 'link'
      next: string
    }

interface CallbackParams {
  flowCookie: string | undefined
  sessionToken: string | undefined
  code: string | undefined
  state: string | undefined
  error: string | undefined
  ip: string | null
  userAgent: string | null
}

export async function handleGoogleCallback(p: CallbackParams): Promise<CallbackOutcome> {
  let intent: 'login' | 'link' = 'login'
  let next = '/'
  try {
    if (!p.flowCookie) throw new AppError('AUTH_SOCIAL_FLOW_INVALID')
    const flow = await consumeFlow(p.flowCookie)
    if (!flow) throw new AppError('AUTH_SOCIAL_FLOW_INVALID')
    intent = flow.intent
    next = safeNextPath(flow.next, intent === 'link' ? '/account/security' : '/')
    return await runCallback(p, flow, next)
  } catch (err) {
    if (!isAppError(err)) throw err
    const reason = typeof err.details?.reason === 'string' ? err.details.reason : undefined
    return { kind: 'error', code: err.code, ...(reason ? { reason } : {}), intent, next }
  }
}

async function runCallback(
  p: CallbackParams,
  flow: OauthFlow,
  next: string,
): Promise<CallbackOutcome> {
  if (p.error !== undefined) {
    throw new AppError('AUTH_SOCIAL_FLOW_INVALID', {
      ...(p.error === 'access_denied' ? { reason: 'cancelled' } : {}),
    })
  }
  const { code, state } = p
  if (
    !code ||
    !state ||
    code.length > MAX_CODE_LENGTH ||
    state.length > MAX_STATE_LENGTH ||
    !constantTimeEquals(state, flow.state)
  ) {
    throw new AppError('AUTH_SOCIAL_FLOW_INVALID')
  }
  if (flow.intent === 'link') await assertLinkSession(p, flow)

  const config = requireConfig()
  const idToken = await exchangeGoogleCode(config, code, flow.code_verifier)
  const claims = await verifyGoogleIdToken(idToken, {
    clientId: config.clientId,
    nonce: flow.nonce,
  })
  const decision = evaluateGoogleEmail(claims)
  if (!decision.ok) throw new AppError('AUTH_SOCIAL_EMAIL_UNVERIFIED')

  const identity = { sub: claims.sub, email: decision.email, name: cleanName(claims.name) }
  let outcome: TxOutcome
  try {
    outcome = await googleTransaction(flow, identity, p)
  } catch (err) {
    const c = pgConstraint(err)
    if (c === 'users_email_key')
      outcome = await googleTransaction(flow, identity, p) // course avec /register
    else if (c !== null) {
      log().error({ constraint: c }, 'oauth google unique violation')
      throw new AppError('AUTH_SOCIAL_FLOW_INVALID')
    } else throw err
  }

  switch (outcome.kind) {
    case 'session':
      if (outcome.signupUser) securityEvent('google_signup', outcome.signupUser)
      return { kind: 'session', token: outcome.token, maxAge: outcome.maxAge, next }
    case 'pending': {
      const linkCookie = randomToken()
      await savePendingLink(linkCookie, {
        provider: 'google',
        sub: identity.sub,
        email: identity.email,
        created_at: Date.now(),
      })
      return { kind: 'pending_link', linkCookie }
    }
    case 'linked':
      if (outcome.user) {
        securityEvent('identity_linked', outcome.user.publicId)
        alert('linked', outcome.user)
      }
      return { kind: 'linked', next }
  }
}

function pgConstraint(err: unknown): string | null {
  const pg = err as { code?: string; constraint_name?: string; constraint?: string }
  return pg?.code === '23505' ? (pg.constraint_name ?? pg.constraint ?? 'unknown') : null
}

/** Nom : 1 à 200 caractères, sans NUL ; sinon null. */
function cleanName(name: unknown): string | null {
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  return trimmed.length >= 1 && trimmed.length <= 200 && !trimmed.includes('\u0000')
    ? trimmed
    : null
}

/** Intention `link` : la session du flux doit être vivante, être celle du navigateur du rappel et appartenir à l'initiateur. */
async function assertLinkSession(p: CallbackParams, flow: OauthFlow): Promise<void> {
  const invalid = new AppError('AUTH_SOCIAL_FLOW_INVALID')
  if (!p.sessionToken || !flow.session_id || !flow.user_id) throw invalid
  const session = await findSessionByTokenHash(hashToken(p.sessionToken))
  if (
    !session ||
    session.revokedAt ||
    new Date(session.expiresAt) < new Date() ||
    session.id.toString() !== flow.session_id ||
    session.userId.toString() !== flow.user_id
  ) {
    throw invalid
  }
}

type TxOutcome =
  | { kind: 'session'; token: string; maxAge: number; signupUser?: string }
  | { kind: 'pending' }
  | { kind: 'linked'; user?: repo.LockedUser }

async function googleTransaction(
  flow: OauthFlow,
  id: { sub: string; email: string; name: string | null },
  p: CallbackParams,
): Promise<TxOutcome> {
  const env = getEnv()
  const session = generateSessionToken()
  const maxAge = flow.remember_me
    ? env.SESSION_REMEMBER_MAX_AGE_SECONDS
    : env.SESSION_MAX_AGE_SECONDS
  const sessionInput = {
    tokenHash: session.hash,
    ip: p.ip,
    userAgent: p.userAgent,
    expiresAt: new Date(Date.now() + maxAge * 1000),
  }
  return repo.inTransaction(id.sub, async (tx): Promise<TxOutcome> => {
    const known = await repo.findIdentityBySub(tx, id.sub)
    if (known) {
      if (known.userDeletedAt !== null || known.userStatus === 'deleted') {
        throw new AppError('AUTH_SIGNUP_CLOSED')
      }
      if (known.userStatus === 'suspended') throw new AppError('AUTH_ACCOUNT_SUSPENDED')
      if (flow.intent === 'link') {
        if (known.userId.toString() !== flow.user_id) {
          throw new AppError('AUTH_IDENTITY_ALREADY_LINKED', { reason: 'sub_linked_elsewhere' })
        }
        return { kind: 'linked' }
      }
      await repo.touchIdentity(tx, known.id, id.email)
      await repo.createSessionTx(tx, { userId: known.userId, ...sessionInput })
      await repo.markLogin(tx, known.userId)
      return { kind: 'session', token: session.token, maxAge }
    }

    if (flow.intent === 'link') {
      const userId = BigInt(flow.user_id ?? '0')
      const user = await repo.lockUser(tx, userId)
      if (!user || user.deletedAt !== null) throw new AppError('AUTH_SOCIAL_FLOW_INVALID')
      assertVerified(user)
      if (await repo.hasGoogleIdentity(tx, userId)) {
        throw new AppError('AUTH_IDENTITY_ALREADY_LINKED', { reason: 'provider_already_linked' })
      }
      await repo.insertIdentity(tx, { userId, sub: id.sub, email: id.email })
      return { kind: 'linked', user }
    }

    const existing = await repo.findUserByEmail(tx, id.email)
    if (existing) {
      if (existing.deletedAt !== null || existing.status === 'deleted') {
        throw new AppError('AUTH_SIGNUP_CLOSED')
      }
      return { kind: 'pending' }
    }
    const created = await repo.createGoogleUser(tx, {
      email: id.email,
      passwordHash: null,
      phoneE164: null,
      phoneVerified: false,
      emailVerified: true,
      status: 'active',
      fullName: id.name,
      orgName: id.name ?? defaultOrgName(flow.locale),
      userCountryCode: null,
      locale: flow.locale,
      countryCode: 'CM',
      defaultCurrency: 'XAF',
      dataRegionCode: 'eu-fr',
    })
    await repo.insertIdentity(tx, { userId: created.userId, sub: id.sub, email: id.email })
    await repo.createSessionTx(tx, { userId: created.userId, ...sessionInput })
    await repo.markLogin(tx, created.userId)
    return { kind: 'session', token: session.token, maxAge, signupUser: created.userPublicId }
  })
}

// ── Liaison en attente ──

/** Liaison en attente propre à l'utilisateur de la session : e-mail égal, sinon 404 (jamais d'indice). */
async function pendingFor(auth: AuthContext, linkCookie: string | undefined) {
  const notFound = new AppError('PLATFORM_RESOURCE_NOT_FOUND')
  if (!linkCookie) throw notFound
  const pending = await peekPendingLink(linkCookie)
  const user = await findUserById(auth.userId)
  if (!pending || !user?.email || user.email.toLowerCase() !== pending.email.toLowerCase())
    throw notFound
  return { pending, user }
}

export async function getPendingLink(auth: AuthContext, linkCookie: string | undefined) {
  const { pending } = await pendingFor(auth, linkCookie)
  return { provider: pending.provider, email_masked: maskEmail(pending.email) }
}

export async function confirmPendingLink(
  auth: AuthContext,
  linkCookie: string | undefined,
): Promise<void> {
  const { pending, user } = await pendingFor(auth, linkCookie)
  assertVerified({ email: user.email, emailVerifiedAt: user.emailVerifiedAt, status: user.status })
  if (new Date(auth.sessionCreatedAt).getTime() < pending.created_at) {
    throw new AppError('AUTH_REAUTH_REQUIRED', { reason: 'login_before_link' })
  }
  await consumeLimit(
    { keyPrefix: 'rl:auth:social:confirm', points: 10, duration: 900 },
    userLimitKey(auth.userId),
  )
  const linked = await repo.inTransaction(pending.sub, async (tx) => {
    const locked = await repo.lockUser(tx, auth.userId)
    if (!locked || locked.deletedAt !== null) throw new AppError('PLATFORM_RESOURCE_NOT_FOUND')
    // Usage unique : la liaison est consommée sous le verrou de l'utilisateur (deux confirmations : une seule gagne).
    if (!linkCookie || !(await consumePendingLink(linkCookie))) {
      throw new AppError('PLATFORM_RESOURCE_NOT_FOUND')
    }
    if (await repo.hasGoogleIdentity(tx, auth.userId)) {
      throw new AppError('AUTH_IDENTITY_ALREADY_LINKED', { reason: 'provider_already_linked' })
    }
    if (await repo.findIdentityBySub(tx, pending.sub)) {
      throw new AppError('AUTH_IDENTITY_ALREADY_LINKED', { reason: 'sub_linked_elsewhere' })
    }
    await repo.insertIdentity(tx, { userId: auth.userId, sub: pending.sub, email: pending.email })
    return locked
  })
  securityEvent('identity_linked', linked.publicId)
  alert('linked', linked)
}

// ── Déliaison ──

/** Ordre : fraîcheur → limite utilisateur → action sous verrou. */
export async function unlinkGoogle(auth: AuthContext): Promise<void> {
  assertFresh(auth.sessionCreatedAt)
  await consumeLimit(
    { keyPrefix: 'rl:auth:social:unlink', points: 10, duration: 3600 },
    userLimitKey(auth.userId),
  )
  const user = await repo.inTransaction(null, async (tx) => {
    const locked = await repo.lockUser(tx, auth.userId)
    if (!locked || !(await repo.hasGoogleIdentity(tx, auth.userId))) {
      throw new AppError('PLATFORM_RESOURCE_NOT_FOUND')
    }
    if ((await repo.countSignInMethods(tx, auth.userId)) <= 1) {
      throw new AppError('AUTH_LAST_SIGN_IN_METHOD')
    }
    await repo.deleteGoogleIdentity(tx, auth.userId)
    return locked
  })
  securityEvent('identity_unlinked', user.publicId)
  alert('unlinked', user)
}
