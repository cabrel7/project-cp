/**
 * Accès aux données de l'authentification par téléphone (P2.2).
 *
 * Rôles : lectures de résolution (blocklist, paramètre du compte gratuit) via `app_auth` ; toutes les écritures
 * en transaction `app_rw`. Jamais `app_admin`. `iam.users`, `verification_tokens` et `user_sessions` n'ont pas
 * d'`organization_id` (tables d'identité globales, pas de RLS : modèle de P2.1) ; la création de l'organisation
 * passe par la fonction SECURITY DEFINER `iam.create_personal_organization` (migration 0003).
 */
import { BlockList, isIP } from 'node:net'
import { getPoolAuth, getPoolRw } from '@cp/db'
import { OTP_TTL_SECONDS } from './auth.phone.config.js'
import { createSessionTx, createUserWithOrgTx, type SqlLike } from './auth.repository.js'

export { getFreeTierRequiresPhoneOtp } from './auth.repository.js'

export interface CountryRules {
  isActive: boolean
  isSignupAllowed: boolean
  defaultCurrency: string
  defaultLanguage: string
}

export interface PhoneUser {
  id: bigint
  publicId: string
  email: string | null
  emailVerifiedAt: string | null
  fullName: string | null
  locale: string
  timezone: string
  createdAt: string
  phoneE164: string | null
  phoneVerifiedAt: string | null
  status: string
}

export type VerifyOtpOutcome =
  | { kind: 'invalid'; remainingAttempts?: number }
  | { kind: 'expired' }
  | { kind: 'exceeded' }
  | { kind: 'suspended' }
  | { kind: 'signup_closed' }
  | {
      kind: 'ok'
      isNewUser: boolean
      user: PhoneUser
      session: { id: bigint; publicId: string }
    }

export interface VerifyOtpParams {
  e164: string
  country: string
  /** Compare le code saisi au `token_hash` stocké (temps constant) ; le pepper reste côté service. */
  codeMatches: (storedHash: Buffer) => boolean
  fullName: string | null
  /** Nom de l'organisation personnelle (nom saisi, sinon libellé par défaut — jamais le numéro). */
  orgName: string
  locale: 'fr' | 'en'
  dataRegionCode: string
  session: { tokenHash: Uint8Array; expiresAt: Date }
  ip: string | null
  userAgent: string | null
}

const iso = (value: unknown): string | null =>
  value === null || value === undefined ? null : new Date(value as string | Date).toISOString()

function toPhoneUser(row: Record<string, unknown>): PhoneUser {
  return {
    id: BigInt(row.id as string),
    publicId: row.public_id as string,
    email: (row.email as string | null) ?? null,
    emailVerifiedAt: iso(row.email_verified_at),
    fullName: (row.full_name as string | null) ?? null,
    locale: row.locale as string,
    timezone: row.timezone as string,
    createdAt: iso(row.created_at) as string,
    phoneE164: (row.phone_e164 as string | null) ?? null,
    phoneVerifiedAt: iso(row.phone_verified_at),
    status: row.status as string,
  }
}

// ── Lectures (app_auth) ──

export async function findUserByPhone(e164: string): Promise<PhoneUser | null> {
  const rows = await getPoolAuth()`
    SELECT id, public_id, email, email_verified_at, full_name, locale, timezone, created_at,
           phone_e164, phone_verified_at, status
      FROM iam.users WHERE phone_e164 = ${e164} AND deleted_at IS NULL LIMIT 1`
  return rows[0] ? toPhoneUser(rows[0]) : null
}

/** Pays de la table `ref.countries` (catalogue public, lisible par `app_rw` sans contexte d'organisation). */
export async function getCountryRules(country: string): Promise<CountryRules | null> {
  const rows = await getPoolRw()`
    SELECT is_active, is_signup_allowed, default_currency, default_language
      FROM ref.countries WHERE code = ${country}`
  const row = rows[0]
  if (!row) return null
  return {
    isActive: row.is_active as boolean,
    isSignupAllowed: row.is_signup_allowed as boolean,
    defaultCurrency: (row.default_currency as string).trim(),
    defaultLanguage: row.default_language as string,
  }
}

function cidrContains(cidr: string, ip: string): boolean {
  const [network, prefix] = cidr.split('/')
  const family = network ? isIP(network) : 0
  const ipFamily = isIP(ip)
  const length = Number(prefix)
  if (!network || family === 0 || family !== ipFamily || !Number.isInteger(length)) return false
  try {
    const list = new BlockList()
    list.addSubnet(network, length, family === 6 ? 'ipv6' : 'ipv4')
    return list.check(ip, family === 6 ? 'ipv6' : 'ipv4')
  } catch {
    return false // une plage mal formée ne bloque personne et ne fait jamais échouer une demande
  }
}

/**
 * Numéro, IP ou plage (CIDR) de `platform.blocklist_entries`, hors entrées expirées. Lue par `app_auth`.
 * Les plages sont comparées côté application : une valeur `cidr` invalide ne peut pas faire échouer la requête SQL.
 */
export async function isBlocked(params: { phone: string; ip: string | null }): Promise<boolean> {
  const rows = await getPoolAuth()`
    SELECT kind, value FROM platform.blocklist_entries
     WHERE (expires_at IS NULL OR expires_at > now())
       AND ((kind = 'phone' AND value = ${params.phone})
         OR (kind = 'ip' AND value = ${params.ip ?? ''})
         OR kind = 'cidr')`
  const ip = params.ip
  return rows.some((r) => r.kind !== 'cidr' || (ip !== null && cidrContains(r.value as string, ip)))
}

// ── Écritures (app_rw) ──

const EXPIRE_ACTIVE = (tx: SqlLike, target: string) => tx`
  UPDATE iam.verification_tokens SET expires_at = now()
   WHERE target = ${target} AND purpose = 'otp_login' AND consumed_at IS NULL AND expires_at > now()`

/** Remplace l'éventuel code actif du numéro par un nouveau (même transaction). `expires_at` calculé par la base. */
export async function issueOtpToken(params: {
  target: string
  tokenHash: Uint8Array
  ip: string | null
}): Promise<void> {
  const hex = Buffer.from(params.tokenHash).toString('hex')
  await getPoolRw().begin(async (tx) => {
    await EXPIRE_ACTIVE(tx, params.target)
    await tx`
      INSERT INTO iam.verification_tokens (purpose, target, token_hash, expires_at, ip)
      VALUES ('otp_login', ${params.target}, decode(${hex}, 'hex'),
              now() + make_interval(secs => ${OTP_TTL_SECONDS}), ${params.ip}::inet)`
  })
}

/** Compensation d'un envoi échoué, ou invalidation : aucun code actif ne reste pour ce numéro. */
export async function expireOtpTokens(target: string): Promise<void> {
  await getPoolRw().begin((tx) => EXPIRE_ACTIVE(tx, target))
}

type LockedToken = {
  id: string
  token_hash: Buffer
  attempts: number
  max_attempts: number
  expired: boolean
  consumed_at: Date | null
}

/**
 * Vérification d'un code, en UNE transaction `app_rw` avec verrou de ligne (`FOR UPDATE`).
 *
 * Piège central : un code faux N'EST PAS une exception ici. La transaction doit VALIDER l'incrément
 * d'essais ; c'est le service qui lève `AUTH_OTP_INVALID` APRÈS le commit (lever dans la transaction
 * l'annulerait : essais illimités). À l'inverse, un échec technique (ex. `create_personal_organization`)
 * est une vraie exception : tout est annulé, y compris la consommation du jeton.
 */
export async function verifyOtpTx(params: VerifyOtpParams): Promise<VerifyOtpOutcome> {
  return getPoolRw().begin(async (tx): Promise<VerifyOtpOutcome> => {
    const tokens = await tx<LockedToken[]>`
      SELECT id, token_hash, attempts, max_attempts, (expires_at <= now()) AS expired, consumed_at
        FROM iam.verification_tokens
       WHERE target = ${params.e164} AND purpose = 'otp_login'
       ORDER BY created_at DESC, id DESC
       LIMIT 1 FOR UPDATE`
    const token = tokens[0]
    if (!token || token.consumed_at !== null) return { kind: 'invalid' }
    if (token.expired) return { kind: 'expired' }
    if (token.attempts >= token.max_attempts) return { kind: 'exceeded' }

    if (!params.codeMatches(token.token_hash)) {
      const updated = await tx`
        UPDATE iam.verification_tokens SET attempts = attempts + 1 WHERE id = ${token.id}::bigint
        RETURNING attempts, max_attempts`
      const row = updated[0]
      const remaining = row ? Number(row.max_attempts) - Number(row.attempts) : 0
      return { kind: 'invalid', remainingAttempts: Math.max(0, remaining) }
    }

    await tx`UPDATE iam.verification_tokens SET attempts = attempts + 1, consumed_at = now() WHERE id = ${token.id}::bigint`
    return signInOrSignUp(tx, params)
  })
}

async function signInOrSignUp(tx: SqlLike, params: VerifyOtpParams): Promise<VerifyOtpOutcome> {
  const existing = await tx`
    SELECT id, public_id, email, email_verified_at, full_name, locale, timezone, created_at,
           phone_e164, phone_verified_at, status
      FROM iam.users
     WHERE phone_e164 = ${params.e164} AND deleted_at IS NULL FOR UPDATE`
  const found = existing[0]
  if (found) {
    if (found.status === 'suspended') return { kind: 'suspended' }
    const session = await createSessionTx(tx, { userId: BigInt(found.id), ...sessionInput(params) })
    await tx`UPDATE iam.users SET last_login_at = now() WHERE id = ${found.id}::bigint`
    return { kind: 'ok', isNewUser: false, user: toPhoneUser(found), session }
  }

  const rules = await tx`
    SELECT is_signup_allowed, default_currency FROM ref.countries WHERE code = ${params.country}`
  if (!rules[0]?.is_signup_allowed) return { kind: 'signup_closed' }

  const created = await createUserWithOrgTx(tx, {
    email: null,
    passwordHash: null,
    phoneE164: params.e164,
    phoneVerified: true,
    status: 'active',
    fullName: params.fullName,
    orgName: params.orgName,
    userCountryCode: params.country,
    locale: params.locale,
    countryCode: params.country,
    defaultCurrency: (rules[0].default_currency as string).trim(),
    dataRegionCode: params.dataRegionCode,
  })
  const session = await createSessionTx(tx, { userId: created.userId, ...sessionInput(params) })
  const rows = await tx`
    UPDATE iam.users SET last_login_at = now() WHERE id = ${created.userId.toString()}::bigint
    RETURNING id, public_id, email, email_verified_at, full_name, locale, timezone, created_at,
              phone_e164, phone_verified_at, status`
  const row = rows[0]
  if (!row) throw new Error('failed to load created user')
  return { kind: 'ok', isNewUser: true, user: toPhoneUser(row), session }
}

function sessionInput(params: VerifyOtpParams) {
  return {
    tokenHash: params.session.tokenHash,
    ip: params.ip,
    userAgent: params.userAgent,
    expiresAt: params.session.expiresAt,
  }
}
