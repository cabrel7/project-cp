/**
 * P2.2 — `isBlocked` : interprétation des plages CIDR de `platform.blocklist_entries` (spec CA-9, §4.4).
 * Test UNITAIRE : seule la frontière « lignes renvoyées par la base » est simulée (le filtre SQL kind/expiration est
 * prouvé en intégration, CA-9). Ce fichier ne touche donc PAS la table partagée : certaines entrées mal formées ci-dessous
 * bloqueraient toutes les adresses si elles étaient insérées pour de vrai pendant que d'autres fichiers tournent.
 *
 * Contrat (commentaire du code) : « une plage mal formée ne bloque personne et ne fait jamais échouer une demande ».
 * Les tests « [DÉFAUT OUVERT] » sont ROUGES tant que le code de production n'est pas corrigé.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  rows: [] as { kind: string; value: string }[],
  failWith: null as Error | null,
}))

vi.mock('@cp/db', () => ({
  getPoolAuth: () => async () => {
    if (db.failWith) throw db.failWith
    return db.rows
  },
  getPoolRw: () => async () => [],
}))

const loadRepo = () => import('../auth.phone.repository.js')

const blocked = async (rows: { kind: string; value: string }[], ip: string | null) => {
  db.rows = rows
  const { isBlocked } = await loadRepo()
  return isBlocked({ phone: '+237690123442', ip })
}
const cidr = (value: string) => ({ kind: 'cidr', value })

beforeEach(() => {
  db.rows = []
  db.failWith = null
})

describe('isBlocked — plages CIDR valides', () => {
  it.each([
    ['10.0.0.0/8', '10.255.255.255', true],
    ['10.0.0.0/8', '11.0.0.0', false],
    ['192.0.2.4/30', '192.0.2.7', true],
    ['192.0.2.4/30', '192.0.2.8', false],
    ['192.0.2.9/32', '192.0.2.9', true],
    ['192.0.2.9/32', '192.0.2.10', false],
    ['10.1.2.3/8', '10.200.0.1', true], // bits d'hôte renseignés : la plage reste /8
    ['2001:db8::/32', '2001:db8:ffff::1', true],
    ['2001:db8::/32', '2001:db9::1', false],
    ['2001:DB8::/32', '2001:db8::1', true], // casse indifférente
    ['2001:db8::1/128', '2001:db8::1', true],
    ['2001:db8::1/128', '2001:db8::2', false],
    ['2001:db8::/32', '10.0.0.1', false], // famille différente
    ['10.0.0.0/8', '2001:db8::1', false],
  ])('plage %s, client %s ⇒ bloqué = %s', async (range, ip, expected) => {
    expect(await blocked([cidr(range)], ip)).toBe(expected)
  })

  it('plusieurs plages : bloqué dès qu’une seule correspond', async () => {
    expect(await blocked([cidr('203.0.113.0/24'), cidr('10.0.0.0/8')], '10.9.9.9')).toBe(true)
    expect(await blocked([cidr('203.0.113.0/24'), cidr('10.0.0.0/8')], '198.51.100.1')).toBe(false)
  })

  it('IP inconnue (null) : une plage ne bloque jamais', async () => {
    expect(await blocked([cidr('0.0.0.0/0'), cidr('10.0.0.0/8')], null)).toBe(false)
  })

  it('une ligne non-cidr renvoyée par le filtre SQL (téléphone ou IP exacte) bloque, une absence de ligne ne bloque pas', async () => {
    expect(await blocked([{ kind: 'phone', value: '+237690123442' }], '198.51.100.1')).toBe(true)
    expect(await blocked([{ kind: 'ip', value: '198.51.100.1' }], '198.51.100.1')).toBe(true)
    expect(await blocked([], '198.51.100.1')).toBe(false)
  })

  it('une panne de la base se propage (jamais « non bloqué » en silence) : la demande échoue en 5xx plutôt que d’envoyer un SMS à un numéro bloqué', async () => {
    db.failWith = new Error('connection terminated')
    const { isBlocked } = await loadRepo()
    await expect(isBlocked({ phone: '+237690123442', ip: '198.51.100.1' })).rejects.toThrow(
      'connection terminated',
    )
  })
})

describe('isBlocked — plages mal formées : ne bloquent personne', () => {
  it.each([
    ['not-a-cidr'],
    ['10.0.0.0'], // sans préfixe
    ['/8'], // sans réseau
    ['10.0.0.0/33'],
    ['10.0.0.0/-1'],
    ['10.0.0.0/abc'],
    ['999.1.1.1/24'],
    ['2001:db8::/129'],
    ['2001:db8::'],
    ['fe80::1%eth0/64'],
    ['10.0.0.0/8x'],
    ['10.0.0.0/NaN'],
    ['10.0.0.0/Infinity'],
    [''],
  ])('« %s » ne bloque ni IPv4 ni IPv6 et ne lève pas', async (range) => {
    expect(await blocked([cidr(range)], '10.1.2.3')).toBe(false)
    expect(await blocked([cidr(range)], '192.0.2.7')).toBe(false)
    expect(await blocked([cidr(range)], '2001:db8::1')).toBe(false)
  })

  it('une plage mal formée n’empêche pas une plage valide voisine de bloquer', async () => {
    expect(await blocked([cidr('n’importe quoi'), cidr('10.0.0.0/8')], '10.1.2.3')).toBe(true)
  })

  // `Number(prefix)` accepte '', ' ', '0x8', '+8', '8.0', '1e1' et `split('/')` ignore un 3e segment : ce ne sont PAS des
  // plages CIDR valides (grammaire stricte : 1 à 3 chiffres décimaux, un seul « / »).
  it.each([
    ['10.0.0.0/', 'préfixe vide interprété comme /0 : bloque TOUTE l’IPv4'],
    ['10.0.0.0/ ', 'préfixe « espace » interprété comme /0 : bloque TOUTE l’IPv4'],
    ['10.0.0.0/0x8', 'hexadécimal interprété comme /8'],
    ['10.0.0.0/+8', 'signe + accepté'],
    ['10.0.0.0/8.0', 'décimale accepté'],
    ['10.0.0.0/1e1', 'notation exponentielle interprétée comme /10'],
    ['10.0.0.0/8/9', 'segment supplémentaire ignoré, lu comme /8'],
  ])('[DÉFAUT OUVERT] « %s » (%s) ne doit bloquer personne', async (range) => {
    expect(await blocked([cidr(range)], '10.1.2.3')).toBe(false)
    expect(await blocked([cidr(range)], '192.0.2.7')).toBe(false)
  })
})
