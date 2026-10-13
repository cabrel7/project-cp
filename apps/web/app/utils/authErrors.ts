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
  // Connexion Google (P2.3) : messages dans cp.errors.<CODE>
  AUTH_SOCIAL_FLOW_INVALID: 'cp.errors.AUTH_SOCIAL_FLOW_INVALID',
  AUTH_SOCIAL_EMAIL_UNVERIFIED: 'cp.errors.AUTH_SOCIAL_EMAIL_UNVERIFIED',
  AUTH_SOCIAL_PROVIDER_UNAVAILABLE: 'cp.errors.AUTH_SOCIAL_PROVIDER_UNAVAILABLE',
  AUTH_ACCOUNT_NOT_VERIFIED: 'cp.errors.AUTH_ACCOUNT_NOT_VERIFIED',
  AUTH_LAST_SIGN_IN_METHOD: 'cp.errors.AUTH_LAST_SIGN_IN_METHOD',
  AUTH_REAUTH_REQUIRED: 'cp.errors.AUTH_REAUTH_REQUIRED',
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
    if (error.code === 'AUTH_IDENTITY_ALREADY_LINKED') {
      const reason = error.details.reason
      return reason === 'sub_linked_elsewhere' || reason === 'provider_already_linked'
        ? `cp.errors.AUTH_IDENTITY_ALREADY_LINKED.${reason}`
        : 'cp.errors.AUTH_IDENTITY_ALREADY_LINKED.default'
    }
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

/**
 * Codes acceptés dans `?error=` (retour du rappel Google). Liste blanche : une valeur inconnue ne produit jamais
 * un message construit à partir du paramètre, seulement le message générique.
 */
const QUERY_ERROR_CODES: readonly string[] = [
  'AUTH_SOCIAL_FLOW_INVALID',
  'AUTH_SOCIAL_EMAIL_UNVERIFIED',
  'AUTH_SOCIAL_PROVIDER_UNAVAILABLE',
  'AUTH_IDENTITY_ALREADY_LINKED',
  'AUTH_ACCOUNT_NOT_VERIFIED',
  'AUTH_LAST_SIGN_IN_METHOD',
  'AUTH_REAUTH_REQUIRED',
  'AUTH_ACCOUNT_SUSPENDED',
  'AUTH_SIGNUP_CLOSED',
  'PLATFORM_RATE_LIMIT',
]

/**
 * Clé i18n du message d'un retour `?error=<CODE>[&reason=cancelled]`. `null` si le paramètre est absent ;
 * clé générique pour toute valeur hors liste blanche (jamais le paramètre brut).
 */
export function queryErrorKey(
  error: unknown,
  reason?: unknown,
  page: 'login' | 'register' = 'login',
): string | null {
  const value = Array.isArray(error) ? error[0] : error
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !QUERY_ERROR_CODES.includes(value)) return 'cp.auth.genericError'
  const why = Array.isArray(reason) ? reason[0] : reason
  if (value === 'AUTH_SOCIAL_FLOW_INVALID' && why === 'cancelled') return 'cp.auth.social.cancelled'
  if (value === 'AUTH_SOCIAL_EMAIL_UNVERIFIED' && page === 'register') {
    return 'cp.errors.AUTH_SOCIAL_EMAIL_UNVERIFIED_SIGNUP'
  }
  return authErrorKey(new AuthError(value, 0))
}
