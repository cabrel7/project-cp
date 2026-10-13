// Middleware nommé `auth` : page réservée à un utilisateur connecté. Sans session : connexion, puis retour ici.
// Une panne réseau ou serveur ne déconnecte pas : la page affiche son propre état d'erreur avec « Réessayer ».
import { AuthError } from '../composables/useAuth'

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchMe } = useAuth()
  if (user.value) return
  try {
    if (await fetchMe()) return
  } catch (e) {
    if (!(e instanceof AuthError) || e.status !== 401) return
  }
  const query = new URLSearchParams({ next: to.fullPath })
  if (to.path === '/auth/link-account') query.set('link', 'google')
  return navigateTo(`/auth/login?${query.toString()}`)
})
