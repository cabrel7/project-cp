import { getDbAuth, getDbRw, getPoolAuth, getPoolRw } from '@cp/db'
import { userSessionsInIam, usersInIam, verificationTokensInIam } from '@cp/db/schema'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

// ── Read helpers (app_auth pool — BYPASSRLS, SELECT only) ──

export async function findUserByEmail(email: string) {
  const db = getDbAuth()
  const [row] = await db
    .select({
      id: usersInIam.id,
      publicId: usersInIam.publicId,
      email: usersInIam.email,
      passwordHash: usersInIam.passwordHash,
      status: usersInIam.status,
      emailVerifiedAt: usersInIam.emailVerifiedAt,
      locale: usersInIam.locale,
      fullName: usersInIam.fullName,
      timezone: usersInIam.timezone,
      createdAt: usersInIam.createdAt,
      phoneE164: usersInIam.phoneE164,
      phoneVerifiedAt: usersInIam.phoneVerifiedAt,
    })
    .from(usersInIam)
    .where(and(eq(usersInIam.email, email), isNull(usersInIam.deletedAt)))
    .limit(1)
  return row ?? null
}

export async function findSessionByTokenHash(hash: Uint8Array) {
  const db = getDbAuth()
  const hexHash = Buffer.from(hash).toString('hex')
  const [row] = await db
    .select({
      id: userSessionsInIam.id,
      publicId: userSessionsInIam.publicId,
      userId: userSessionsInIam.userId,
      expiresAt: userSessionsInIam.expiresAt,
      revokedAt: userSessionsInIam.revokedAt,
      lastSeenAt: userSessionsInIam.lastSeenAt,
    })
    .from(userSessionsInIam)
    .where(eq(userSessionsInIam.tokenHash, sql`decode(${hexHash}, 'hex')`))
    .limit(1)
  return row ?? null
}

export async function findUserById(userId: bigint) {
  const db = getDbAuth()
  const [row] = await db
    .select({
      id: usersInIam.id,
      publicId: usersInIam.publicId,
      email: usersInIam.email,
      emailVerifiedAt: usersInIam.emailVerifiedAt,
      fullName: usersInIam.fullName,
      locale: usersInIam.locale,
      timezone: usersInIam.timezone,
      status: usersInIam.status,
      createdAt: usersInIam.createdAt,
      phoneE164: usersInIam.phoneE164,
      phoneVerifiedAt: usersInIam.phoneVerifiedAt,
    })
    .from(usersInIam)
    .where(and(eq(usersInIam.id, userId), isNull(usersInIam.deletedAt)))
    .limit(1)
  return row ?? null
}

// ── Write helpers (app_rw pool) ──

export type SignupResult = {
  userId: bigint
  userPublicId: string
  orgId: bigint
  orgPublicId: string
}

/** Transaction `app_rw` ouverte par `pool.begin` (les variantes `…Tx` ne s'exécutent jamais hors transaction). */
export type SqlLike = Parameters<Parameters<ReturnType<typeof getPoolRw>['begin']>[1]>[0]

/**
 * Crée l'utilisateur ET son organisation personnelle dans la transaction fournie (tout ou rien).
 * Sert l'inscription e-mail (P2.1 : e-mail + mot de passe, statut `pending`) et l'inscription par
 * téléphone (P2.2 : ni e-mail ni mot de passe, numéro déjà vérifié, statut `active`).
 */
export async function createUserWithOrgTx(
  tx: SqlLike,
  params: {
    email: string | null
    passwordHash: string | null
    phoneE164: string | null
    /** Un numéro n'est enregistré que vérifié (CHECK `users_phone_requires_verification`). */
    phoneVerified: boolean
    status: 'pending' | 'active'
    fullName: string | null
    orgName: string
    /** Pays enregistré sur l'utilisateur (null : non renseigné, comme en P2.1). */
    userCountryCode: string | null
    locale: string
    countryCode: string
    defaultCurrency: string
    dataRegionCode: string
  },
): Promise<SignupResult> {
  const userRows = await tx`
    INSERT INTO iam.users
      (email, password_hash, phone_e164, phone_verified_at, full_name, locale, country_code, status)
    VALUES
      (${params.email}, ${params.passwordHash}, ${params.phoneE164},
       CASE WHEN ${params.phoneVerified}::boolean THEN now() END, ${params.fullName}, ${params.locale},
       ${params.userCountryCode}, ${params.status})
    RETURNING id, public_id
  `
  const userRow = userRows[0]
  if (!userRow) throw new Error('failed to insert user')

  const userId = BigInt(userRow.id)
  const userPublicId = userRow.public_id as string

  await tx`SELECT set_config('app.user_id', ${userId.toString()}, true)`

  const orgRows = await tx`
    SELECT org_id, org_public_id FROM iam.create_personal_organization(
      ${userId.toString()}::bigint,
      ${userPublicId},
      ${params.orgName},
      ${params.countryCode}::char(2),
      ${params.defaultCurrency}::char(3),
      ${params.locale},
      ${params.dataRegionCode}
    )
  `
  const orgRow = orgRows[0]
  if (!orgRow) throw new Error('failed to create personal organization')

  return {
    userId,
    userPublicId,
    orgId: BigInt(orgRow.org_id),
    orgPublicId: orgRow.org_public_id as string,
  }
}

export async function createUserWithOrg(params: {
  email: string
  passwordHash: string
  fullName: string | null
  locale: string
  countryCode: string
  defaultCurrency: string
  dataRegionCode: string
}): Promise<SignupResult> {
  return getPoolRw().begin((tx) =>
    createUserWithOrgTx(tx, {
      email: params.email,
      passwordHash: params.passwordHash,
      phoneE164: null,
      phoneVerified: false,
      status: 'pending',
      fullName: params.fullName,
      orgName: params.fullName ?? params.email,
      userCountryCode: null,
      locale: params.locale,
      countryCode: params.countryCode,
      defaultCurrency: params.defaultCurrency,
      dataRegionCode: params.dataRegionCode,
    }),
  )
}

export async function createSessionTx(
  tx: SqlLike,
  params: {
    userId: bigint
    tokenHash: Uint8Array
    ip: string | null
    userAgent: string | null
    expiresAt: Date
  },
): Promise<{ id: bigint; publicId: string }> {
  const hexHash = Buffer.from(params.tokenHash).toString('hex')
  const rows = await tx`
    INSERT INTO iam.user_sessions (user_id, token_hash, ip, user_agent, expires_at)
    VALUES (${params.userId.toString()}::bigint, decode(${hexHash}, 'hex'), ${params.ip}::inet,
            ${params.userAgent ? params.userAgent.slice(0, 512) : null}, ${params.expiresAt.toISOString()}::timestamptz)
    RETURNING id, public_id
  `
  const row = rows[0]
  if (!row) throw new Error('failed to insert session')
  return { id: BigInt(row.id), publicId: row.public_id as string }
}

export async function createSession(params: {
  userId: bigint
  tokenHash: Uint8Array
  ip: string | null
  userAgent: string | null
  expiresAt: Date
}): Promise<{ id: bigint; publicId: string }> {
  return getPoolRw().begin((tx) => createSessionTx(tx, params))
}

/**
 * Règle D59 : `free_tier.require_phone_otp` n'est lisible ni par `app_rw` ni par `app_auth`
 * (paramètre non public) ; seule la fonction SECURITY DEFINER `platform.free_tier_requires_phone_otp()` l'expose.
 */
export async function getFreeTierRequiresPhoneOtp(): Promise<boolean> {
  const rows = await getPoolAuth()`SELECT platform.free_tier_requires_phone_otp() AS required`
  return rows[0]?.required !== false
}

export async function revokeSession(sessionId: bigint): Promise<void> {
  const db = getDbRw()
  await db
    .update(userSessionsInIam)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(userSessionsInIam.id, sessionId), isNull(userSessionsInIam.revokedAt)))
}

export async function revokeAllUserSessions(
  userId: bigint,
  exceptSessionId?: bigint,
): Promise<void> {
  const db = getDbRw()
  const conditions = [eq(userSessionsInIam.userId, userId), isNull(userSessionsInIam.revokedAt)]
  if (exceptSessionId !== undefined) {
    conditions.push(sql`${userSessionsInIam.id} != ${exceptSessionId}`)
  }
  await db
    .update(userSessionsInIam)
    .set({ revokedAt: sql`now()` })
    .where(and(...conditions))
}

export async function touchSession(sessionId: bigint, newExpiresAt: Date): Promise<void> {
  const db = getDbRw()
  await db
    .update(userSessionsInIam)
    .set({
      lastSeenAt: sql`now()`,
      expiresAt: newExpiresAt.toISOString(),
    })
    .where(eq(userSessionsInIam.id, sessionId))
}

export async function listUserSessions(userId: bigint) {
  const db = getDbAuth()
  return db
    .select({
      id: userSessionsInIam.id,
      publicId: userSessionsInIam.publicId,
      ip: userSessionsInIam.ip,
      userAgent: userSessionsInIam.userAgent,
      deviceLabel: userSessionsInIam.deviceLabel,
      createdAt: userSessionsInIam.createdAt,
      lastSeenAt: userSessionsInIam.lastSeenAt,
    })
    .from(userSessionsInIam)
    .where(
      and(
        eq(userSessionsInIam.userId, userId),
        isNull(userSessionsInIam.revokedAt),
        sql`${userSessionsInIam.expiresAt} > now()`,
      ),
    )
    .orderBy(desc(userSessionsInIam.lastSeenAt))
}

export async function createVerificationToken(params: {
  userId: bigint
  purpose: string
  target: string
  tokenHash: Uint8Array
  expiresAt: Date
  ip: string | null
}): Promise<void> {
  const db = getDbRw()
  const hexHash = Buffer.from(params.tokenHash).toString('hex')
  await db.insert(verificationTokensInIam).values({
    userId: params.userId,
    purpose: params.purpose,
    target: params.target,
    tokenHash: sql`decode(${hexHash}, 'hex')`,
    expiresAt: params.expiresAt.toISOString(),
    ip: params.ip,
  })
}

export async function consumeVerificationToken(tokenHash: Uint8Array, purpose: string) {
  const db = getDbRw()
  const hexHash = Buffer.from(tokenHash).toString('hex')
  const [row] = await db
    .update(verificationTokensInIam)
    .set({ consumedAt: sql`now()` })
    .where(
      and(
        eq(verificationTokensInIam.tokenHash, sql`decode(${hexHash}, 'hex')`),
        eq(verificationTokensInIam.purpose, purpose),
        isNull(verificationTokensInIam.consumedAt),
        sql`${verificationTokensInIam.expiresAt} > now()`,
        sql`${verificationTokensInIam.attempts} < ${verificationTokensInIam.maxAttempts}`,
      ),
    )
    .returning({
      id: verificationTokensInIam.id,
      userId: verificationTokensInIam.userId,
      target: verificationTokensInIam.target,
    })
  return row ?? null
}

export async function updateUserPassword(userId: bigint, passwordHash: string): Promise<void> {
  const db = getDbRw()
  await db
    .update(usersInIam)
    .set({ passwordHash, updatedAt: sql`now()` })
    .where(eq(usersInIam.id, userId))
}

export async function resetPasswordTx(params: {
  tokenHash: Uint8Array
  passwordHash: string
}): Promise<{ userId: bigint; target: string } | null> {
  const pool = getPoolRw()
  const hexHash = Buffer.from(params.tokenHash).toString('hex')

  return pool.begin(async (tx) => {
    const tokenRows = await tx`
      UPDATE iam.verification_tokens
      SET consumed_at = now()
      WHERE token_hash = decode(${hexHash}, 'hex')
        AND purpose = 'reset_password'
        AND consumed_at IS NULL
        AND expires_at > now()
        AND attempts < max_attempts
      RETURNING id, user_id, target
    `
    const token = tokenRows[0]
    if (!token) return null

    await tx`
      UPDATE iam.verification_tokens
      SET consumed_at = now()
      WHERE user_id = ${token.user_id}
        AND purpose = 'reset_password'
        AND consumed_at IS NULL
        AND id != ${token.id}
    `

    await tx`
      UPDATE iam.users
      SET password_hash = ${params.passwordHash}, updated_at = now()
      WHERE id = ${token.user_id}
    `

    await tx`
      UPDATE iam.user_sessions
      SET revoked_at = now()
      WHERE user_id = ${token.user_id}
        AND revoked_at IS NULL
    `

    return { userId: BigInt(token.user_id), target: token.target as string }
  })
}

export async function markEmailVerified(userId: bigint): Promise<void> {
  const db = getDbRw()
  await db
    .update(usersInIam)
    .set({ emailVerifiedAt: sql`now()`, status: 'active', updatedAt: sql`now()` })
    .where(and(eq(usersInIam.id, userId), eq(usersInIam.status, 'pending')))
}

export async function updateLastLogin(userId: bigint): Promise<void> {
  const db = getDbRw()
  await db.update(usersInIam).set({ lastLoginAt: sql`now()` }).where(eq(usersInIam.id, userId))
}
