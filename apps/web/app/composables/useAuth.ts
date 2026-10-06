// Authentification par e-mail (P2.1) : appelle l'API /v1/auth/* ; la session est un cookie HttpOnly posé par l'API.
export interface AuthUser {
  id: string
  email: string | null
  email_verified: boolean
  full_name: string | null
  locale: string
  timezone: string
  created_at: string
}

interface AuthResponse {
  user: AuthUser
}

/** Erreur API normalisée : `code` = code d'erreur du catalogue (ex. AUTH_INVALID_CREDENTIALS). */
export class AuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(code)
    this.name = 'AuthError'
  }
}

interface ApiErrorPayload {
  error?: { code?: string; request_id?: string }
}

function toAuthError(e: unknown): AuthError {
  const err = e as { statusCode?: number; status?: number; data?: ApiErrorPayload }
  return new AuthError(
    err.data?.error?.code ?? 'UNKNOWN',
    err.statusCode ?? err.status ?? 0,
    err.data?.error?.request_id,
  )
}

export function useAuth() {
  const config = useRuntimeConfig()
  const user = useState<AuthUser | null>('auth-user', () => null)
  const isLoading = useState<boolean>('auth-loading', () => false)
  const isAuthenticated = computed(() => user.value !== null)

  const base = String(config.public.apiBase ?? '')

  async function call<T>(
    path: string,
    options: { method?: 'GET' | 'POST'; body?: Record<string, unknown> } = {},
  ): Promise<T> {
    isLoading.value = true
    try {
      return await $fetch<T>(`${base}/v1/auth${path}`, {
        method: options.method ?? 'POST',
        body: options.body,
        credentials: 'include',
        headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
      })
    } catch (e) {
      throw toAuthError(e)
    } finally {
      isLoading.value = false
    }
  }

  async function login(email: string, password: string, rememberMe: boolean) {
    const res = await call<AuthResponse>('/login', {
      body: { email, password, remember_me: rememberMe },
    })
    user.value = res.user
    await navigateTo('/')
  }

  async function register(email: string, password: string, fullName?: string) {
    await call<{ ok: boolean }>('/register', {
      body: { email, password, ...(fullName ? { full_name: fullName } : {}) },
    })
  }

  async function logout() {
    try {
      await call<unknown>('/logout')
    } finally {
      user.value = null
      await navigateTo('/auth/login')
    }
  }

  async function forgotPassword(email: string) {
    await call<unknown>('/forgot-password', { body: { email } })
  }

  async function resetPassword(token: string, password: string) {
    await call<unknown>('/reset-password', {
      body: { token, password },
    })
  }

  async function verifyEmail(token: string) {
    await call<unknown>('/verify-email', { body: { token } })
  }

  async function fetchMe(): Promise<AuthUser | null> {
    try {
      user.value = await call<AuthUser>('/me', { method: 'GET' })
    } catch (e) {
      if (e instanceof AuthError && e.status === 401) user.value = null
      else throw e
    }
    return user.value
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    verifyEmail,
    fetchMe,
  }
}
