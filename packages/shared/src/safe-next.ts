/** Longueur maximale d'un chemin de redirection conservé (borne anti-abus, identique côté API et côté front). */
const MAX_NEXT_LENGTH = 512

/** Origine fictive : sert uniquement à vérifier qu'un chemin relatif ne change pas d'origine après analyse. */
const PROBE_ORIGIN = 'https://x.invalid'

/**
 * Chemin interne sûr pour une redirection après connexion (`?next=`), partagé par l'API et le front.
 * Anti « redirection ouverte » : seule une chaîne qui commence par UN `/`, sans `\`, sans caractère de contrôle,
 * qui reste sur l'origine après analyse par le parseur d'URL, est conservée. Sinon : `fallback`.
 */
export function safeNextPath(input: unknown, fallback = '/'): string {
  if (typeof input !== 'string') return fallback
  if (input.length === 0 || input.length > MAX_NEXT_LENGTH) return fallback
  if (!input.startsWith('/') || input.startsWith('//')) return fallback
  // Barre oblique inverse (traitée comme `/` par les navigateurs) et caractères de contrôle (supprimés par le parseur).
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f || input[i] === '\\') return fallback
  }
  try {
    const url = new URL(input, PROBE_ORIGIN)
    if (url.origin !== PROBE_ORIGIN) return fallback
    // Un chemin décodé qui commencerait par `//` ou `/\` serait interprété comme un hôte par certains relais.
    const decoded = decodeURIComponent(url.pathname)
    if (decoded.startsWith('//') || decoded.includes('\\')) return fallback
  } catch {
    return fallback
  }
  return input
}
