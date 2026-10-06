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
  RATE_LIMITED: 'cp.auth.rateLimited',
}

export function authErrorKey(error: unknown): string {
  if (error instanceof AuthError) {
    if (error.status === 429) return 'cp.auth.rateLimited'
    return AUTH_ERROR_KEYS[error.code] ?? 'cp.auth.genericError'
  }
  return 'cp.auth.genericError'
}
