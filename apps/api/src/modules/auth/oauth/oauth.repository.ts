/**
 * Accès aux données de la connexion Google (P2.3).
 *
 * `iam.user_identities` n'a ni `organization_id`, ni RLS, ni droit `app_auth` (comme `iam.users`) : tout passe par
 * `app_rw` en transaction, et chaque requête est filtrée par l'`user_id` de la session (jamais par un id venu du client).
 * Verrous : `pg_advisory_xact_lock` par `sub` (sérialise les rappels concurrents) puis `SELECT … FOR UPDATE` de
 * l'utilisateur (sérialise liaison, confirmation et déliaison). Ordre constant sub → utilisateur : pas d'interblocage.
 */
import { getPoolRw } from '@cp/db'
import {
  createSessionTx,
  createUserWithOrgTx,
  type SignupResult,
  type SqlLike,
} from '../auth.repository.js'

export type Tx = SqlLike

export interface LockedUser {
  id: bigint
  publicId: string
  email: string | null
  emailVerifiedAt: string | null
  status: string
  deletedAt: string | null
  locale: string
  hasPassword: boolean
  phoneVerified: boolean
}

export interface IdentityRow {
  id: bigint
  userId: bigint
  userPublicId: string
  userStatus: string
  userDeletedAt: string | null
}

/** Transaction `app_rw`, verrou consultatif sur le `sub` Google (peut être omis pour les opérations sans `sub`). */
export function inTransaction<T>(sub: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getPoolRw().begin(async (tx) => {
    if (sub !== null) await tx`SELECT pg_advisory_xact_lock(hashtext(${`oauth:google:${sub}`}))`
    return fn(tx)
  }) as Promise<T>
}

const toLockedUser = (r: Record<string, unknown>): LockedUser => ({
  id: BigInt(r.id as string),
  publicId: r.public_id as string,
  email: (r.email as string | null) ?? null,
  emailVerifiedAt: r.email_verified_at
    ? new Date(r.email_verified_at as string).toISOString()
    : null,
  status: r.status as string,
  deletedAt: r.deleted_at ? new Date(r.deleted_at as string).toISOString() : null,
  locale: r.locale as string,
  hasPassword: r.has_password as boolean,
  phoneVerified: r.phone_verified_at !== null,
})

const USER_COLUMNS = `id, public_id, email, email_verified_at, status, deleted_at, locale,
  password_hash IS NOT NULL AS has_password, phone_verified_at`

export async function lockUser(tx: Tx, userId: bigint): Promise<LockedUser | null> {
  const rows = await tx.unsafe(
    `SELECT ${USER_COLUMNS} FROM iam.users WHERE id = $1::bigint FOR UPDATE`,
    [userId.toString()],
  )
  return rows[0] ? toLockedUser(rows[0]) : null
}

export async function findUserByEmail(tx: Tx, email: string): Promise<LockedUser | null> {
  const rows = await tx.unsafe(`SELECT ${USER_COLUMNS} FROM iam.users WHERE email = $1`, [email])
  return rows[0] ? toLockedUser(rows[0]) : null
}

export async function findIdentityBySub(tx: Tx, sub: string): Promise<IdentityRow | null> {
  const rows = await tx`
    SELECT i.id, i.user_id, u.public_id, u.status, u.deleted_at
      FROM iam.user_identities i JOIN iam.users u ON u.id = i.user_id
     WHERE i.provider = 'google' AND i.provider_user_id = ${sub}`
  const r = rows[0]
  if (!r) return null
  return {
    id: BigInt(r.id as string),
    userId: BigInt(r.user_id as string),
    userPublicId: r.public_id as string,
    userStatus: r.status as string,
    userDeletedAt: r.deleted_at ? new Date(r.deleted_at as string).toISOString() : null,
  }
}

/**
 * Identité connue, relue APRÈS le verrou de son utilisateur : ordre constant sub → utilisateur → identité, le même que
 * la déliaison (`lockUser` puis `DELETE`). Sinon le rappel prend la ligne d'identité puis attend l'utilisateur (FK de la
 * session) pendant que la déliaison fait l'inverse : interblocage. La relecture (nouvel instantané en READ COMMITTED)
 * voit une déliaison validée pendant l'attente → `null` (parcours « identité inconnue »). Le `sub` ne peut pas changer
 * d'utilisateur entre les deux lectures : toute insertion de ce `sub` prend le verrou consultatif détenu ici.
 */
export async function findIdentityBySubLocked(tx: Tx, sub: string): Promise<IdentityRow | null> {
  const first = await findIdentityBySub(tx, sub)
  if (!first) return null
  await lockUser(tx, first.userId)
  const again = await findIdentityBySub(tx, sub)
  return again && again.userId === first.userId ? again : null
}

export async function hasGoogleIdentity(tx: Tx, userId: bigint): Promise<boolean> {
  const rows = await tx`
    SELECT 1 FROM iam.user_identities WHERE user_id = ${userId.toString()}::bigint AND provider = 'google'`
  return rows.length > 0
}

export async function insertIdentity(
  tx: Tx,
  p: { userId: bigint; sub: string; email: string },
): Promise<void> {
  await tx`
    INSERT INTO iam.user_identities (user_id, provider, provider_user_id, email, profile, last_used_at)
    VALUES (${p.userId.toString()}::bigint, 'google', ${p.sub}, ${p.email}, '{}'::jsonb, now())`
}

export async function touchIdentity(tx: Tx, identityId: bigint, email: string): Promise<void> {
  await tx`
    UPDATE iam.user_identities SET last_used_at = now(), email = ${email}
     WHERE id = ${identityId.toString()}::bigint`
}

export async function markLogin(tx: Tx, userId: bigint): Promise<void> {
  await tx`UPDATE iam.users SET last_login_at = now() WHERE id = ${userId.toString()}::bigint`
}

export async function createGoogleUser(
  tx: Tx,
  p: Parameters<typeof createUserWithOrgTx>[1],
): Promise<SignupResult> {
  return createUserWithOrgTx(tx, p)
}

export { createSessionTx }

/** Supprime l'identité Google de l'utilisateur ; `false` si elle n'existe pas. */
export async function deleteGoogleIdentity(tx: Tx, userId: bigint): Promise<boolean> {
  const rows = await tx`
    DELETE FROM iam.user_identities WHERE user_id = ${userId.toString()}::bigint AND provider = 'google'
    RETURNING id`
  return rows.length > 0
}

/** Moyens de connexion : mot de passe (avec e-mail) + numéro vérifié + identités liées. */
export async function countSignInMethods(tx: Tx, userId: bigint): Promise<number> {
  const rows = await tx`
    SELECT (CASE WHEN u.email IS NOT NULL AND u.password_hash IS NOT NULL THEN 1 ELSE 0 END)
         + (CASE WHEN u.phone_verified_at IS NOT NULL THEN 1 ELSE 0 END)
         + (SELECT count(*) FROM iam.user_identities i WHERE i.user_id = u.id) AS n
      FROM iam.users u WHERE u.id = ${userId.toString()}::bigint`
  return Number(rows[0]?.n ?? 0)
}
