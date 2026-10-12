import { AuthError } from '../composables/useAuth'
import { phoneReasonKey } from './phoneAuth'

// Code d'erreur API (catalogue AUTH_*) -> clé i18n affichable. Jamais le message brut du serveur.
const AUTH_ERROR_KEYS: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: 'cp.auth.login.invalidCredentials',
  AUTH_EMAIL_ALREADY_EXISTS: 'cp.auth.register.emailExists',
  AUTH_PASSWORD_TOO_WEAK: 'cp.auth.register.passwordWeak',
  AUTH_VERIFICATION_TOKEN_EXPIRED: 'cp.auth.reset.invalidToken',
  AUTH_VERIFICATION_TOKEN_INVALID: 'cp.auth.reset.invalidToken',
  AUTH_TOKEN_INVALID: 'cp.auth.reset.invalidToken',
  AUTH_TOKEN_EXPIRED: 'cp.auth.reset.invalidToken',
  AUTH_SIGNUP_CLOSED: 'cp.auth.signupClosed',
  AUTH_ACCOUNT_SUSPENDED: 'cp.auth.accountSuspended',
  AUTH_OTP_INVALID: 'cp.auth.code.invalid',
  AUTH_OTP_EXPIRED: 'cp.auth.code.expired',
  AUTH_OTP_ATTEMPTS_EXCEEDED: 'cp.auth.code.tooManyAttempts',
  AUTH_SMS_UNAVAILABLE: 'cp.auth.code.smsUnavailable',
  PLATFORM_RATE_LIMIT: 'cp.auth.rateLimited',
  RATE_LIMITED: 'cp.auth.rateLimited',
}

/** Erreur de saisie du téléphone (422 PLATFORM_VALIDATION_ERROR, `details.field === 'phone'`). */
export function isPhoneValidationError(error: unknown): boolean {
  return (
    error instanceof AuthError &&
    error.code === 'PLATFORM_VALIDATION_ERROR' &&
    error.details.field === 'phone'
  )
}

export function authErrorKey(error: unknown): string {
  if (error instanceof AuthError) {
    if (isPhoneValidationError(error)) {
      const reason = error.details.reason
      return phoneReasonKey(typeof reason === 'string' ? reason : undefined)
    }
    if (error.status === 429) return 'cp.auth.rateLimited'
    return Object.hasOwn(AUTH_ERROR_KEYS, error.code)
      ? (AUTH_ERROR_KEYS[error.code] ?? 'cp.auth.genericError')
      : 'cp.auth.genericError'
  }
  return 'cp.auth.genericError'
}

/** Paramètres d'interpolation du message (`count` = essais restants, `n` = chiffres attendus). */
export function authErrorParams(
  error: unknown,
  context: { countryName?: string } = {},
): { params: Record<string, unknown>; plural?: number } {
  if (!(error instanceof AuthError)) return { params: {} }
  if (error.code === 'AUTH_OTP_INVALID') {
    const remaining = Number(error.details.remaining_attempts)
    const count = Number.isFinite(remaining) && remaining >= 0 ? remaining : 0
    return { params: { count }, plural: count }
  }
  if (isPhoneValidationError(error) && error.details.reason === 'TOO_SHORT') {
    const n = Number(error.details.expected_length)
    return {
      params: { n: Number.isFinite(n) ? n : '', country: context.countryName ?? '' },
      plural: 1,
    }
  }
  return { params: {} }
}
