import type { AuthMethodsResponse } from '@cp/shared/auth-social-schemas'
import { type VisibleSocialButtons, visibleSocialButtons } from '../utils/socialMethods'

/**
 * Méthodes de connexion proposées (`GET /v1/auth/methods`). Lu côté navigateur : l'API est jointe par le proxy
 * `/v1/**` avec les cookies de la page. En chargement ou en erreur : aucun bouton social (échec fermé), les formulaires
 * e-mail et téléphone restent utilisables.
 */
export function useAuthMethods() {
  const config = useRuntimeConfig()
  const base = String(config.public.apiBase ?? '')
  const { data } = useAsyncData<AuthMethodsResponse | null>(
    'auth-methods',
    () => $fetch<AuthMethodsResponse>(`${base}/v1/auth/methods`).catch(() => null),
    { server: false, lazy: true, default: () => null },
  )
  const buttons = computed<VisibleSocialButtons>(() => visibleSocialButtons(data.value))
  return { methods: data, buttons }
}
