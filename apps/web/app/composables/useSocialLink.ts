// Liaison / déliaison de Google (P2.3). Mêmes conventions d'appel que useAuth : cookie de session HttpOnly,
// erreurs normalisées en AuthError. Aucune donnée du fournisseur n'est lue côté navigateur.
import type { LinkPendingResponse, OauthLinkResponse } from '@cp/shared/auth-social-schemas'
import { toAuthError } from './useAuth'

export function useSocialLink() {
  const config = useRuntimeConfig()
  const base = String(config.public.apiBase ?? '')

  async function call<T>(
    path: string,
    method: 'GET' | 'POST' | 'DELETE',
    body?: Record<string, unknown>,
  ): Promise<T> {
    try {
      return await $fetch<T>(`${base}/v1/auth${path}`, {
        method,
        body,
        credentials: 'include',
      })
    } catch (e) {
      throw toAuthError(e)
    }
  }

  /** Liaison en attente (cookie `cp_link`) : e-mail du compte Google, masqué. */
  const linkPending = () => call<LinkPendingResponse>('/link/pending', 'GET')

  /** Confirme la liaison en attente (204). */
  const confirmLink = () => call<void>('/link/confirm', 'POST')

  /** Lie Google depuis la session : renvoie l'URL d'autorisation et y envoie le navigateur. */
  async function startLinkFromSession(next: string): Promise<void> {
    const res = await call<OauthLinkResponse>('/oauth/google/link', 'POST', { next })
    window.location.assign(res.authorization_url)
  }

  /** Retire Google du compte (204). */
  const unlink = (provider: 'google') => call<void>(`/identities/${provider}`, 'DELETE')

  return { linkPending, confirmLink, startLinkFromSession, unlink }
}
