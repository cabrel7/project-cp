// Connexion / inscription par téléphone + code SMS (P2.2). Même mécanisme d'appel que useAuth
// (le client généré n'existe pas encore) ; la session est un cookie HttpOnly posé par l'API.
// La demande en cours vit en sessionStorage (jamais localStorage) ; le code saisi n'est ni stocké ni journalisé.

import type { PhoneRequestCodeResponse, PhoneVerifyCodeResponse } from '@cp/shared'
import { safeNextPath } from '@cp/shared/safe-next'
import {
  clearPhoneRequest,
  loadPhoneRequest,
  type PhoneIntent,
  type PhoneRequestState,
  savePhoneRequest,
  secondsUntil,
} from '../utils/phoneAuth'
import type { AuthUser } from './useAuth'
import { toAuthError } from './useAuth'

export interface PhoneRequestInput {
  e164: string
  country: string
  intent: PhoneIntent
  fullName?: string
}

export function usePhoneAuth() {
  const config = useRuntimeConfig()
  const { locale } = useI18n()
  const { user } = useAuth()
  const base = String(config.public.apiBase ?? '')

  const request = useState<PhoneRequestState | null>('phone-auth-request', () => null)
  const isLoading = useState<boolean>('phone-auth-loading', () => false)

  // Horloge (compte à rebours) et état réseau : actifs seulement côté navigateur, nettoyés au démontage.
  const now = ref(Date.now())
  const isOnline = ref(true)
  let timer: ReturnType<typeof setInterval> | undefined
  const syncOnline = () => {
    isOnline.value = navigator.onLine
  }
  onMounted(() => {
    syncOnline()
    now.value = Date.now()
    timer = setInterval(() => {
      now.value = Date.now()
    }, 1000)
    window.addEventListener('online', syncOnline)
    window.addEventListener('offline', syncOnline)
  })
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
    window.removeEventListener('online', syncOnline)
    window.removeEventListener('offline', syncOnline)
  })

  const resendSeconds = computed(() =>
    request.value ? secondsUntil(request.value.resendAt, now.value) : 0,
  )
  const canResend = computed(() => resendSeconds.value === 0)
  const apiLocale = computed<'fr' | 'en'>(() => (locale.value === 'en' ? 'en' : 'fr'))

  async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
    isLoading.value = true
    try {
      return await $fetch<T>(`${base}/v1/auth/phone${path}`, {
        method: 'POST',
        body,
        credentials: 'include',
      })
    } catch (e) {
      throw toAuthError(e)
    } finally {
      isLoading.value = false
    }
  }

  /** Relit la demande en cours (rechargement de page). Renvoie null si aucune. */
  function restore(): PhoneRequestState | null {
    if (!import.meta.client) return null
    request.value = loadPhoneRequest(sessionStorage)
    return request.value
  }

  /** Demande un code SMS. Lève AuthError (429, 503, 422 validation…) sans rien mémoriser. */
  async function requestCode(input: PhoneRequestInput): Promise<PhoneRequestState> {
    const res = await call<PhoneRequestCodeResponse>('/request-code', {
      phone: input.e164,
      country: input.country,
      locale: apiLocale.value,
    })
    const at = Date.now()
    now.value = at
    const state: PhoneRequestState = {
      e164: input.e164,
      country: input.country,
      intent: input.intent,
      ...(input.fullName ? { fullName: input.fullName } : {}),
      expiresAt: at + res.expires_in_seconds * 1000,
      resendAt: at + res.resend_after_seconds * 1000,
    }
    request.value = state
    if (import.meta.client) savePhoneRequest(sessionStorage, state)
    return state
  }

  /** Renvoie un code pour la demande en cours (compte à rebours relancé). */
  async function resend(): Promise<PhoneRequestState> {
    const current = request.value
    if (!current) throw toAuthError({ statusCode: 0 })
    return requestCode(current)
  }

  /** Vérifie le code ; succès = session ouverte, demande effacée, retour à l'accueil (ou à `next`). */
  async function verifyCode(code: string, next = '/'): Promise<PhoneVerifyCodeResponse> {
    const current = request.value
    if (!current) throw toAuthError({ statusCode: 0 })
    const res = await call<PhoneVerifyCodeResponse>('/verify-code', {
      phone: current.e164,
      country: current.country,
      code,
      ...(current.fullName ? { full_name: current.fullName } : {}),
      remember_me: true,
      locale: apiLocale.value,
    })
    user.value = res.user as unknown as AuthUser
    cancel()
    await navigateTo(safeNextPath(next))
    return res
  }

  /** Abandonne la demande (« Modifier », succès). */
  function cancel() {
    request.value = null
    if (import.meta.client) clearPhoneRequest(sessionStorage)
  }

  return {
    request,
    isLoading,
    isOnline,
    resendSeconds,
    canResend,
    restore,
    requestCode,
    resend,
    verifyCode,
    cancel,
  }
}
