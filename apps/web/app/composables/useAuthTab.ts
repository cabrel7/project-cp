// Onglet E-mail | Téléphone des écrans de connexion et d'inscription, synchronisé avec `?tab=`.
// Les liens internes (ex. « Utiliser mon e-mail » de l'alerte SMS indisponible) pointent vers la même
// page sans `?tab=` : l'onglet doit suivre l'URL, et l'URL suivre l'onglet choisi à la main.
export type AuthTab = 'email' | 'phone'

const fromQuery = (value: unknown): AuthTab => (value === 'phone' ? 'phone' : 'email')

export function useAuthTab() {
  const route = useRoute()
  const router = useRouter()
  const tab = ref<string>(fromQuery(route.query.tab))

  watch(
    () => route.query.tab,
    (value) => {
      tab.value = fromQuery(value)
    },
  )

  watch(tab, (value) => {
    if (fromQuery(route.query.tab) === fromQuery(value)) return
    const { tab: _previous, ...rest } = route.query
    router.replace({ query: fromQuery(value) === 'phone' ? { ...rest, tab: 'phone' } : rest })
  })

  return tab
}
