/**
 * P2.3 — `safeNextPath` : chemin interne sûr, partagé par l'API (redirections) ET le front (`?next=`).
 * Règle testée : spec P2.3 CA-4 (partie U) et §3.1. Anti « redirection ouverte » : seule une chaîne qui reste sur
 * l'origine du site est conservée, sinon `fallback` (défaut `/`).
 *
 * Phase RED : `../safe-next.js` n'existe pas encore. Import dynamique à chemin calculé : chaque test échoue
 * individuellement avec « module absent » (au lieu d'un fichier sans aucun test collecté).
 */
import { describe, expect, it } from 'vitest'

type SafeNext = typeof import('../safe-next.js')
const SAFE_NEXT_PATH = '../safe-next.js'
const load = async (): Promise<SafeNext> =>
  (await import(/* @vite-ignore */ SAFE_NEXT_PATH)) as SafeNext

describe('safeNextPath — valeurs hostiles ramenées au repli (CA-4, redirection ouverte)', () => {
  it.each([
    ['//evil.com', 'schéma relatif (hôte injecté)'],
    ['https://evil.com', 'URL absolue'],
    ['/\\evil.com', 'barre oblique inverse après le /'],
    ['/%5C%5Cevil.com', 'barre oblique inverse encodée (décodée par certains navigateurs/proxys)'],
    ['javascript:alert(1)', 'schéma javascript'],
    ['/\t/evil', 'tabulation (le parseur d’URL la supprime et obtient //evil)'],
    ['/\n/evil', 'saut de ligne'],
    ['/\r/evil', 'retour chariot'],
    ['/a\u0000b', 'octet NUL'],
    ['\\\\evil.com', 'UNC / barres inverses seules'],
    [`/${'a'.repeat(599)}`, 'chaîne de 600 caractères'],
    ['', 'chaîne vide'],
    ['account/security', 'chemin sans barre initiale'],
    ['data:text/html,<script>', 'schéma data'],
    ['///evil.com', 'trois barres'],
  ])('doit ramener %j à « / » (%s)', async (input) => {
    const { safeNextPath } = await load()
    expect(safeNextPath(input)).toBe('/')
  })

  it.each([[null], [undefined], [42], [{}], [['/ok']], [true]])(
    'doit ramener la valeur non textuelle %j à « / »',
    async (input) => {
      const { safeNextPath } = await load()
      expect(safeNextPath(input)).toBe('/')
    },
  )
})

describe('safeNextPath — chemins internes conservés', () => {
  it.each([
    ['/account/security?x=1'],
    ['/'],
    ['/auth/link-account'],
    ['/a/b?c=d&e=f#frag'],
    ['/account/security?linked=google'],
  ])('doit conserver %j tel quel', async (input) => {
    const { safeNextPath } = await load()
    expect(safeNextPath(input)).toBe(input)
  })

  it('doit accepter exactement 512 caractères et refuser 513 (borne de longueur)', async () => {
    const { safeNextPath } = await load()
    const ok = `/${'a'.repeat(511)}`
    const tooLong = `/${'a'.repeat(512)}`
    expect(ok).toHaveLength(512)
    expect(safeNextPath(ok)).toBe(ok)
    expect(safeNextPath(tooLong)).toBe('/')
  })
})

describe('safeNextPath — repli personnalisé', () => {
  it('doit renvoyer le repli fourni quand la valeur est refusée', async () => {
    const { safeNextPath } = await load()
    expect(safeNextPath('//evil.com', '/dashboard')).toBe('/dashboard')
    expect(safeNextPath(undefined, '/dashboard')).toBe('/dashboard')
  })

  it('doit ignorer le repli quand la valeur est valide', async () => {
    const { safeNextPath } = await load()
    expect(safeNextPath('/account/security', '/dashboard')).toBe('/account/security')
  })
})
