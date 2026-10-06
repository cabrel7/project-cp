import type { AuthResponse, MeResponse, SessionResponse } from '@cp/shared/auth-schemas'
import { getEnv } from '../../env.js'
import { AppError } from '../../lib/errors.js'
import { sendPasswordResetEmail, sendVerificationEmail } from './auth.email.js'
import {
  dummyVerify,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from './auth.password.js'
import * as repo from './auth.repository.js'
import { toMeResponse, toSessionResponse } from './auth.resource.js'
import { generateSessionToken, generateVerificationToken, hashToken } from './auth.token.js'

function sessionMaxAge(remember: boolean): number {
  const env = getEnv()
  return remember ? env.SESSION_REMEMBER_MAX_AGE_SECONDS : env.SESSION_MAX_AGE_SECONDS
}

function expiresAt(remember: boolean): Date {
  return new Date(Date.now() + sessionMaxAge(remember) * 1000)
}

/**
 * Règle D59 (spec §4.4) : éligible à l'offre gratuite ⇔ `NOT free_tier.require_phone_otp` OU numéro vérifié.
 * Le paramètre n'est lisible que par la fonction SECURITY DEFINER (repository) ; le numéro vérifié dispense de la lire.
 */
async function isFreeTierEligible(user: { phoneVerifiedAt: string | null }): Promise<boolean> {
  if (user.phoneVerifiedAt !== null) return true
  return !(await repo.getFreeTierRequiresPhoneOtp())
}

// ── Register ──

export async function register(params: {
  email: string
  password: string
  fullName?: string | null
  ip: string | null
  userAgent: string | null
}): Promise<void> {
  if (!validatePasswordStrength(params.password)) {
    throw new AppError('AUTH_PASSWORD_TOO_WEAK')
  }

  const existing = await repo.findUserByEmail(params.email)
  if (existing) return

  const passwordHash = await hashPassword(params.password)

  const signupResult = await repo
    .createUserWithOrg({
      email: params.email,
      passwordHash,
      fullName: params.fullName ?? null,
      locale: 'fr',
      countryCode: 'CM',
      defaultCurrency: 'XAF',
      dataRegionCode: 'eu-fr',
    })
    .catch((err: unknown) => {
      const pgErr = err as { code?: string; constraint_name?: string; constraint?: string }
      if (pgErr.code === '23505') {
        const constraint = pgErr.constraint_name ?? pgErr.constraint ?? ''
        if (constraint.includes('email')) {
          return null
        }
      }
      throw err
    })

  if (!signupResult) return

  const { token: verifyToken, hash: verifyHash } = generateVerificationToken()
  await repo.createVerificationToken({
    userId: signupResult.userId,
    purpose: 'verify_email',
    target: params.email,
    tokenHash: verifyHash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ip: params.ip,
  })

  void sendVerificationEmail(params.email, verifyToken, 'fr').catch(() => {})
}

// ── Login ──

export async function login(params: {
  email: string
  password: string
  rememberMe: boolean
  ip: string | null
  userAgent: string | null
}): Promise<{ authResponse: AuthResponse; token: string; maxAge: number }> {
  const user = await repo.findUserByEmail(params.email)

  if (!user) {
    await dummyVerify()
    throw new AppError('AUTH_INVALID_CREDENTIALS')
  }

  if (!user.passwordHash) {
    await dummyVerify()
    throw new AppError('AUTH_INVALID_CREDENTIALS')
  }

  const valid = await verifyPassword(user.passwordHash, params.password)
  if (!valid) {
    throw new AppError('AUTH_INVALID_CREDENTIALS')
  }

  if (user.status === 'suspended') {
    throw new AppError('AUTH_ACCOUNT_SUSPENDED')
  }

  const { token, hash } = generateSessionToken()
  const maxAge = sessionMaxAge(params.rememberMe)
  const session = await repo.createSession({
    userId: user.id,
    tokenHash: hash,
    ip: params.ip,
    userAgent: params.userAgent,
    expiresAt: expiresAt(params.rememberMe),
  })

  await repo.updateLastLogin(user.id)

  return {
    authResponse: {
      user: toMeResponse({ ...user, freeTierEligible: await isFreeTierEligible(user) }),
      session: toSessionResponse(
        {
          publicId: session.publicId,
          ip: params.ip,
          userAgent: params.userAgent,
          deviceLabel: null,
          createdAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
        },
        session.id,
        session.id,
      ),
    },
    token,
    maxAge,
  }
}

// ── Logout ──

export async function logout(sessionId: bigint): Promise<void> {
  await repo.revokeSession(sessionId)
}

export async function logoutAll(userId: bigint, currentSessionId?: bigint): Promise<void> {
  await repo.revokeAllUserSessions(userId, currentSessionId)
}

// ── Sessions ──

export async function listSessions(
  userId: bigint,
  currentSessionId: bigint,
): Promise<SessionResponse[]> {
  const sessions = await repo.listUserSessions(userId)
  return sessions.map((s) => toSessionResponse(s, currentSessionId, s.id))
}

export async function revokeSessionById(
  userId: bigint,
  sessionPublicId: string,
  currentSessionPublicId: string,
): Promise<void> {
  const sessions = await repo.listUserSessions(userId)
  const target = sessions.find((s) => s.publicId === sessionPublicId)
  if (!target) {
    throw new AppError('PLATFORM_RESOURCE_NOT_FOUND')
  }
  if (target.publicId === currentSessionPublicId) {
    throw new AppError('PLATFORM_RESOURCE_NOT_FOUND')
  }
  await repo.revokeSession(target.id)
}

// ── Forgot password ──

export async function forgotPassword(params: { email: string; ip: string | null }): Promise<void> {
  const user = await repo.findUserByEmail(params.email)
  if (!user) return

  const { token, hash } = generateVerificationToken()
  await repo.createVerificationToken({
    userId: user.id,
    purpose: 'reset_password',
    target: params.email,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    ip: params.ip,
  })

  void sendPasswordResetEmail(params.email, token, user.locale).catch(() => {})
}

// ── Reset password ──

export async function resetPassword(params: { token: string; password: string }): Promise<void> {
  if (!validatePasswordStrength(params.password)) {
    throw new AppError('AUTH_PASSWORD_TOO_WEAK')
  }

  const passwordHash = await hashPassword(params.password)
  const hash = hashToken(params.token)

  const result = await repo.resetPasswordTx({ tokenHash: hash, passwordHash })
  if (!result) {
    throw new AppError('AUTH_VERIFICATION_TOKEN_INVALID')
  }
}

// ── Verify email ──

export async function verifyEmail(token: string): Promise<void> {
  const hash = hashToken(token)
  const consumed = await repo.consumeVerificationToken(hash, 'verify_email')
  if (!consumed) {
    throw new AppError('AUTH_VERIFICATION_TOKEN_INVALID')
  }

  if (!consumed.userId) {
    throw new AppError('AUTH_VERIFICATION_TOKEN_INVALID')
  }

  await repo.markEmailVerified(consumed.userId)
}

// ── Resend verification ──

export async function resendVerification(params: {
  userId: bigint
  ip: string | null
}): Promise<void> {
  const user = await repo.findUserById(params.userId)
  if (!user?.email) return
  if (user.emailVerifiedAt) return

  const { token, hash } = generateVerificationToken()
  await repo.createVerificationToken({
    userId: user.id,
    purpose: 'verify_email',
    target: user.email,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ip: params.ip,
  })

  await sendVerificationEmail(user.email, token, user.locale).catch(() => {})
}

// ── Me ──

export async function getMe(userId: bigint): Promise<MeResponse> {
  const user = await repo.findUserById(userId)
  if (!user) throw new AppError('AUTH_INVALID_CREDENTIALS')
  return toMeResponse({ ...user, freeTierEligible: await isFreeTierEligible(user) })
}
