import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeCursor, encodeCursor, extractTimestamp, generatePublicId } from '../public-id.js'

// Règle (CLAUDE.md invariant 1) : seul le UUIDv7 `public_id` est exposé (API, URL, SDK).
// Le curseur de pagination est dérivé de ce public_id et doit être réversible sans perte.
const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// Vecteur connu, calculé indépendamment : 0x01890a5dac96 = 1688096058518 ms = 2023-06-30T03:34:18.518Z
const KNOWN_UUID = '01890a5d-ac96-774b-bcce-b302099a8057'
const KNOWN_TIMESTAMP_MS = 1688096058518

describe('generatePublicId', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('doit retourner un UUID version 7 (36 caractères, variante RFC) quand appelé', () => {
    const id = generatePublicId()

    expect(id).toHaveLength(36)
    expect(id).toMatch(UUID_V7_RE)
  })

  it('doit retourner des valeurs uniques sur 10 000 appels successifs', () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => generatePublicId()))

    expect(ids.size).toBe(10_000)
  })

  it('doit produire des identifiants triables dans l ordre de création (pagination par curseur)', () => {
    const ids = Array.from({ length: 1_000 }, () => generatePublicId())

    expect([...ids].sort()).toEqual(ids)
  })

  it('doit encoder l horloge courante dans les 48 premiers bits', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(KNOWN_TIMESTAMP_MS))

    const id = generatePublicId()

    expect(extractTimestamp(id).getTime()).toBe(KNOWN_TIMESTAMP_MS)
  })
})

describe('extractTimestamp', () => {
  it('doit retourner une date proche de maintenant (< 1 s) pour un identifiant neuf', () => {
    const before = Date.now()
    const id = generatePublicId()
    const after = Date.now()

    const ts = extractTimestamp(id).getTime()

    expect(ts).toBeGreaterThanOrEqual(before - 1_000)
    expect(ts).toBeLessThanOrEqual(after + 1_000)
  })

  it('doit retourner la date attendue pour un UUIDv7 connu', () => {
    const date = extractTimestamp(KNOWN_UUID)

    expect(date.getTime()).toBe(KNOWN_TIMESTAMP_MS)
    expect(date.toISOString()).toBe('2023-06-30T03:34:18.518Z')
  })

  it('doit retourner l epoch pour un timestamp nul (borne basse)', () => {
    expect(extractTimestamp('00000000-0000-7000-8000-000000000000').getTime()).toBe(0)
  })

  it('doit retourner la valeur maximale sur 48 bits pour un timestamp saturé (borne haute)', () => {
    // 0xffffffffffff = 281474976710655 ms
    expect(extractTimestamp('ffffffff-ffff-7000-8000-000000000000').getTime()).toBe(281474976710655)
  })
})

describe('encodeCursor / decodeCursor', () => {
  it('doit retrouver l UUID d origine après encodeCursor puis decodeCursor', () => {
    const id = generatePublicId()

    expect(decodeCursor(encodeCursor(id))).toBe(id)
  })

  it('doit retrouver l UUID connu après un aller-retour', () => {
    expect(decodeCursor(encodeCursor(KNOWN_UUID))).toBe(KNOWN_UUID)
  })

  it('doit retrouver le curseur d origine après decodeCursor puis encodeCursor', () => {
    const cursor = encodeCursor(generatePublicId())

    expect(encodeCursor(decodeCursor(cursor))).toBe(cursor)
  })

  it('doit produire un curseur compact de 22 caractères base64url, sans remplissage, sûr en URL', () => {
    const cursor = encodeCursor(KNOWN_UUID)

    expect(cursor).toHaveLength(22)
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(cursor).not.toContain('=')
    expect(cursor).not.toContain(KNOWN_UUID)
  })

  it('doit garder l aller-retour exact pour les bornes (tout à zéro, tout à un)', () => {
    for (const uuid of [
      '00000000-0000-0000-0000-000000000000',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
    ]) {
      expect(decodeCursor(encodeCursor(uuid))).toBe(uuid)
    }
  })

  it('doit rester stable sur 1 000 identifiants aléatoires', () => {
    for (let i = 0; i < 1_000; i++) {
      const id = generatePublicId()
      expect(decodeCursor(encodeCursor(id))).toBe(id)
    }
  })

  // Conception : le curseur vient du client (entrée non fiable). decodeCursor ne valide rien : une
  // chaîne quelconque produit une « chaîne UUID » malformée qui ira jusqu'à la requête SQL (erreur 22P02
  // au lieu d'un 422 propre). Test volontairement non figé sur le comportement actuel, à activer quand
  // decodeCursor rejettera les curseurs invalides (throw ou null).
  it.todo('doit rejeter un curseur invalide (longueur != 16 octets, caractères hors base64url)')
})

describe('validation des entrées (curseur / public_id)', () => {
  it('decodeCursor doit rejeter un curseur invalide', () => {
    for (const bad of ['', 'abc', '!!!', 'AAAA', encodeCursor(generatePublicId()) + 'A']) {
      expect(() => decodeCursor(bad)).toThrow(TypeError)
    }
  })

  it('encodeCursor / extractTimestamp doivent rejeter un identifiant non UUID', () => {
    expect(() => encodeCursor('not-a-uuid')).toThrow(TypeError)
    expect(() => extractTimestamp('zzzz')).toThrow(TypeError)
  })
})
