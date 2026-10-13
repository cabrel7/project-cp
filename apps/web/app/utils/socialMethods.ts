/** Réponse de `GET /v1/auth/methods` (forme minimale utile à l'affichage). */
export interface SocialMethodFlags {
  passkey?: unknown
  google?: unknown
  apple?: unknown
}

export interface VisibleSocialButtons {
  passkey: boolean
  google: boolean
  apple: boolean
  separator: boolean
}

/**
 * Boutons de connexion sociale à afficher. Un bouton n'apparaît que si son indicateur serveur vaut strictement `true`
 * (échec fermé : réponse absente, partielle ou invalide = aucun bouton). Le séparateur « ou » suppose au moins un bouton.
 */
export function visibleSocialButtons(
  methods: SocialMethodFlags | null | undefined,
): VisibleSocialButtons {
  const passkey = methods?.passkey === true
  const google = methods?.google === true
  const apple = methods?.apple === true
  return { passkey, google, apple, separator: passkey || google || apple }
}
