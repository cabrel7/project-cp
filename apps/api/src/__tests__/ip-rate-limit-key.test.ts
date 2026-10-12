/**
 * Clé de limite de débit PAR IP (revue PR #18, MAJOR « limite par IP contournable en IPv6 »).
 *
 * Un client IPv6 possède au minimum un /64 (2^64 adresses) : si la clé de limite est l'adresse complète, il change
 * d'adresse à chaque requête et la limite ne s'applique jamais. La clé de LIMITE utilise donc le préfixe /64 pour
 * l'IPv6 ; l'IPv4 reste inchangée (une adresse = une clé) ; une IPv4 vue en notation IPv6 (`::ffff:a.b.c.d`) retombe
 * sur sa forme IPv4. L'adresse COMPLÈTE reste celle de `getClientIp` (blocklist exacte, audit `ip` des jetons/sessions).
 *
 * CONTRAT DE TEST (code de production attendu) — `apps/api/src/lib/client-ip.ts` :
 *
 *   export function ipRateLimitKey(ip: string): string
 *
 *   - IPv4                        → l'adresse telle quelle           ('203.0.113.5' → '203.0.113.5')
 *   - IPv4 en notation IPv6       → la forme IPv4 (toutes notations)  ('::ffff:1.2.3.4', '::ffff:102:304',
 *                                   '0:0:0:0:0:ffff:102:304' → '1.2.3.4')
 *   - IPv6                        → préfixe /64 canonique : les 4 premiers groupes en hexadécimal minuscule sans zéro
 *                                   de tête, séparés par ':', suivis de '::/64'
 *                                   ('2001:0DB8:0001:0002:aaaa:bbbb:cccc:dddd' → '2001:db8:1:2::/64')
 *   La fonction est pure (aucun accès à l'environnement) et ne lève pas pour une adresse valide.
 *   `ipRateLimit` (middlewares/rate-limit.ts) l'applique à `getClientIp(c)` avant `consumeLimit` ; `getClientIp`
 *   continue de renvoyer l'adresse COMPLÈTE.
 */
import { Hono } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetEnvCache } from '../env.js'
import { getClientIp, ipRateLimitKey } from '../lib/client-ip.js'
import { socketEnv } from '../modules/auth/__tests__/phone-test-utils.js'

describe('ipRateLimitKey — IPv4', () => {
  it.each(['203.0.113.5', '10.0.0.1', '0.0.0.0', '255.255.255.255', '192.168.1.200'])(
    'doit renvoyer l’adresse IPv4 %s inchangée',
    (ip) => {
      expect(ipRateLimitKey(ip)).toBe(ip)
    },
  )

  it('doit donner des clés différentes à deux IPv4 voisines (pas de regroupement par /24)', () => {
    expect(ipRateLimitKey('203.0.113.5')).not.toBe(ipRateLimitKey('203.0.113.6'))
  })
})

describe('ipRateLimitKey — IPv4 vue en notation IPv6 (::ffff:a.b.c.d)', () => {
  it.each([
    '::ffff:1.2.3.4',
    '::FFFF:1.2.3.4',
    '::ffff:0102:0304',
    '::ffff:102:304',
    '0:0:0:0:0:ffff:1.2.3.4',
  ])('doit ramener %s à la clé IPv4 « 1.2.3.4 »', (ip) => {
    expect(ipRateLimitKey(ip)).toBe('1.2.3.4')
  })

  it('doit ramener aussi la forme hexadécimale développée (0:0:0:0:0:ffff:102:304) à l’IPv4, jamais au préfixe ::/64', () => {
    // Sinon tous les clients IPv4 d'un serveur double pile partageraient UNE clé « 0:0:0:0::/64 » : déni de service.
    expect(ipRateLimitKey('0:0:0:0:0:ffff:102:304')).toBe('1.2.3.4')
    expect(ipRateLimitKey('0000:0000:0000:0000:0000:ffff:0102:0304')).toBe('1.2.3.4')
  })

  it('doit donner des clés différentes à deux IPv4 différentes reçues en notation IPv6', () => {
    expect(ipRateLimitKey('::ffff:1.2.3.4')).not.toBe(ipRateLimitKey('::ffff:1.2.3.5'))
  })

  it('doit donner la même clé à une IPv4 et à sa notation IPv6 (un seul quota)', () => {
    expect(ipRateLimitKey('::ffff:203.0.113.9')).toBe(ipRateLimitKey('203.0.113.9'))
  })
})

describe('ipRateLimitKey — IPv6 : préfixe /64', () => {
  const NET = '2001:db8:1:2'

  it('doit donner la même clé à deux adresses du même /64 (identifiants d’interface différents)', () => {
    const keys = new Set(
      [
        `${NET}:aaaa:bbbb:cccc:dddd`,
        `${NET}:1:2:3:4`,
        `${NET}:ffff:ffff:ffff:ffff`,
        `${NET}::1`,
        `${NET}::`,
        `${NET}:0:0:0:1`,
      ].map(ipRateLimitKey),
    )
    expect(keys.size).toBe(1)
  })

  it('doit donner des clés différentes à deux /64 différents (4ᵉ groupe qui change)', () => {
    expect(ipRateLimitKey('2001:db8:1:2::1')).not.toBe(ipRateLimitKey('2001:db8:1:3::1'))
  })

  it('doit donner des clés différentes quand un des 3 premiers groupes change', () => {
    const base = ipRateLimitKey('2001:db8:1:2::1')
    expect(ipRateLimitKey('2002:db8:1:2::1')).not.toBe(base)
    expect(ipRateLimitKey('2001:db9:1:2::1')).not.toBe(base)
    expect(ipRateLimitKey('2001:db8:2:2::1')).not.toBe(base)
  })

  it('doit placer la frontière exactement après le 4ᵉ groupe : le 5ᵉ groupe ne compte pas, le 4ᵉ compte (bit de poids faible)', () => {
    expect(ipRateLimitKey('2001:db8:1:2:0:0:0:1')).toBe(ipRateLimitKey('2001:db8:1:2:8000::1'))
    expect(ipRateLimitKey('2001:db8:1:2::1')).not.toBe(ipRateLimitKey('2001:db8:1:3::1'))
    expect(ipRateLimitKey('2001:db8:1:2::1')).not.toBe(ipRateLimitKey('2001:db8:1:0::1'))
  })

  it.each([
    '2001:0db8:0000:0000:0000:0000:0000:0001',
    '2001:db8::1',
    '2001:DB8::1',
    '2001:Db8:0:0::1',
    '2001:db8:0:0:0:0:0:1',
    '2001:db8::',
    '2001:db8:0:0:ffff:ffff:ffff:ffff',
  ])(
    'doit donner la même clé à la forme %s (compressée, développée, casse) du /64 2001:db8:0:0',
    (ip) => {
      expect(ipRateLimitKey(ip)).toBe(ipRateLimitKey('2001:db8::1'))
    },
  )

  it('doit traiter « :: » et « ::1 » comme le même /64 (0:0:0:0) et « 0:0:0:0:0:0:0:1 » comme « ::1 »', () => {
    expect(ipRateLimitKey('::')).toBe(ipRateLimitKey('::1'))
    expect(ipRateLimitKey('0:0:0:0:0:0:0:1')).toBe(ipRateLimitKey('::1'))
  })

  it('doit rendre la clé canonique : 4 groupes minuscules sans zéro de tête, puis « ::/64 » (format du contrat)', () => {
    expect(ipRateLimitKey('2001:0DB8:0001:0002:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64')
    expect(ipRateLimitKey('2001:db8::1')).toBe('2001:db8:0:0::/64')
    expect(ipRateLimitKey('FE80::1')).toBe('fe80:0:0:0::/64')
  })

  it('ne doit jamais contenir l’identifiant d’interface (64 bits de poids faible) dans la clé', () => {
    const key = ipRateLimitKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd')
    for (const part of ['aaaa', 'bbbb', 'cccc', 'dddd']) expect(key).not.toContain(part)
  })

  it('ne doit jamais coïncider avec une clé IPv4 (espaces de noms distincts)', () => {
    expect(ipRateLimitKey('2001:db8::1')).not.toMatch(/^\d{1,3}(\.\d{1,3}){3}$/)
  })

  it('doit être déterministe (même entrée, même sortie)', () => {
    expect(ipRateLimitKey('2001:db8:1:2:9:8:7:6')).toBe(ipRateLimitKey('2001:db8:1:2:9:8:7:6'))
  })
})

describe('getClientIp — conserve l’adresse COMPLÈTE (blocklist exacte et audit), seule la clé de limite regroupe', () => {
  const app = new Hono().get('/ip', (c) => c.json({ ip: getClientIp(c) }))

  afterEach(() => {
    vi.unstubAllEnvs()
    resetEnvCache()
  })

  it('doit renvoyer l’adresse IPv6 complète de la socket, pas son préfixe /64', async () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '0')
    resetEnvCache()
    const full = '2001:db8:1:2:aaaa:bbbb:cccc:dddd'
    const res = await app.request('/ip', {}, socketEnv(full))
    expect(((await res.json()) as { ip: string }).ip).toBe(full)
    expect(ipRateLimitKey(full)).not.toBe(full)
  })

  it('doit renvoyer l’adresse IPv6 complète ajoutée par le proxy de confiance (1 saut)', async () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '1')
    resetEnvCache()
    const full = '2001:db8:1:2:1:2:3:4'
    const res = await app.request(
      '/ip',
      { headers: { 'x-forwarded-for': `9.9.9.9, ${full}` } },
      socketEnv('10.0.0.2'),
    )
    expect(((await res.json()) as { ip: string }).ip).toBe(full)
  })
})
