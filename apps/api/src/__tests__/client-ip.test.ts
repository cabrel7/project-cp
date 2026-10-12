/**
 * `getClientIp` (cp-security « IP client ») : IP de la socket, et derrière un proxy de confiance la valeur ajoutée par ce
 * proxy (nombre de sauts configuré) — JAMAIS la première valeur de `x-forwarded-for`, fournie par le client.
 * Utilisée par la limite de débit et la blocklist de l'authentification par téléphone (P2.2).
 */
import { Hono } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetEnvCache } from '../env.js'
import { getClientIp } from '../lib/client-ip.js'
import { socketEnv } from '../modules/auth/__tests__/phone-test-utils.js'

const app = new Hono().get('/ip', (c) => c.json({ ip: getClientIp(c) }))

async function ipFor(opts: { hops: number; socket?: string | null; xff?: string }) {
  vi.stubEnv('TRUSTED_PROXY_HOPS', String(opts.hops))
  resetEnvCache()
  const headers: Record<string, string> =
    opts.xff === undefined ? {} : { 'x-forwarded-for': opts.xff }
  const res = await app.request(
    '/ip',
    { headers },
    opts.socket === null || opts.socket === undefined ? undefined : socketEnv(opts.socket),
  )
  return ((await res.json()) as { ip: string | null }).ip
}

afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

describe('getClientIp — sans proxy de confiance (TRUSTED_PROXY_HOPS=0)', () => {
  it('renvoie l’IP de la socket et ignore tout X-Forwarded-For forgé', async () => {
    expect(await ipFor({ hops: 0, socket: '203.0.113.5', xff: '1.2.3.4, 5.6.7.8' })).toBe(
      '203.0.113.5',
    )
  })

  it('renvoie null (jamais 127.0.0.1) quand il n’y a pas de socket', async () => {
    expect(await ipFor({ hops: 0 })).toBeNull()
    expect(await ipFor({ hops: 0, xff: '1.2.3.4' })).toBeNull()
  })

  it('renvoie null quand l’adresse de la socket n’est pas une IP valide', async () => {
    expect(await ipFor({ hops: 0, socket: 'not-an-ip' })).toBeNull()
    expect(await ipFor({ hops: 0, socket: '' })).toBeNull()
  })

  it('conserve une adresse IPv6 canonique telle quelle', async () => {
    expect(await ipFor({ hops: 0, socket: '2001:db8::1' })).toBe('2001:db8::1')
  })
})

describe('getClientIp — derrière un proxy de confiance', () => {
  it('1 saut : prend la dernière valeur (ajoutée par le proxy), pas la première (fournie par le client)', async () => {
    expect(await ipFor({ hops: 1, socket: '10.0.0.2', xff: '9.9.9.9, 203.0.113.7' })).toBe(
      '203.0.113.7',
    )
  })

  it('2 sauts : prend l’avant-dernière valeur', async () => {
    expect(
      await ipFor({ hops: 2, socket: '10.0.0.2', xff: '9.9.9.9, 203.0.113.7, 10.0.0.9' }),
    ).toBe('203.0.113.7')
  })

  it('tolère les espaces autour des valeurs et accepte une IPv6', async () => {
    expect(await ipFor({ hops: 1, socket: '10.0.0.2', xff: ' 9.9.9.9 ,   2001:db8::7 ' })).toBe(
      '2001:db8::7',
    )
  })

  it('en-tête absent : retombe sur l’IP de la socket', async () => {
    expect(await ipFor({ hops: 1, socket: '10.0.0.2' })).toBe('10.0.0.2')
  })

  it('valeur du proxy qui n’est pas une IP (« unknown », injection) : retombe sur l’IP de la socket', async () => {
    expect(await ipFor({ hops: 1, socket: '10.0.0.2', xff: '9.9.9.9, unknown' })).toBe('10.0.0.2')
    expect(
      await ipFor({ hops: 1, socket: '10.0.0.2', xff: "9.9.9.9, 1.1.1.1'; DROP TABLE x;--" }),
    ).toBe('10.0.0.2')
  })

  it('moins de valeurs que de sauts configurés : retombe sur l’IP de la socket (jamais la valeur du client)', async () => {
    expect(await ipFor({ hops: 3, socket: '10.0.0.2', xff: '9.9.9.9, 203.0.113.7' })).toBe(
      '10.0.0.2',
    )
  })

  it('sans socket ni en-tête exploitable : null', async () => {
    expect(await ipFor({ hops: 1, xff: 'unknown' })).toBeNull()
  })
})

describe('getClientIp — IPv4 reçue en notation IPv6', () => {
  it('[DÉFAUT OUVERT] une IPv4 vue par une socket double pile (::ffff:a.b.c.d) est ramenée à sa forme IPv4 canonique', async () => {
    // Sinon la blocklist (IP exacte, plage IPv4) et les clés de limite par IP ne reconnaissent pas le client.
    expect(await ipFor({ hops: 0, socket: '::ffff:203.0.113.5' })).toBe('203.0.113.5')
  })
})
