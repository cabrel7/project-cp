import { isIP } from 'node:net'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'
import { getEnv } from '../env.js'

/** Remplace une éventuelle queue IPv4 pointée (`::ffff:1.2.3.4`) par ses deux groupes hexadécimaux. */
function dottedTailToGroups(part: string): string[] {
  const dotted = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(part)
  if (!dotted) return [part]
  const [a, b, c, d] = dotted.slice(1).map(Number) as [number, number, number, number]
  return [((a << 8) | b).toString(16), ((c << 8) | d).toString(16)]
}

/** Développe une IPv6 valide (toute notation) en 8 groupes de 16 bits ; `null` si ce n'est pas une IPv6. */
function expandIpv6(ip: string): number[] | null {
  if (isIP(ip) !== 6) return null
  const addr = ip.split('%')[0] ?? ip // identifiant de zone (`fe80::1%eth0`) ignoré
  const halves = addr.split('::')
  if (halves.length > 2) return null
  const toGroups = (s: string): string[] =>
    s === '' ? [] : s.split(':').flatMap(dottedTailToGroups)
  const head = toGroups(halves[0] ?? '')
  const tail = halves.length === 2 ? toGroups(halves[1] ?? '') : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? missing !== 0 : missing < 0) return null
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  const values = groups.map((g) => Number.parseInt(g, 16))
  return values.length === 8 && values.every((v) => Number.isInteger(v) && v >= 0 && v <= 0xffff)
    ? values
    : null
}

/**
 * IPv4 vue en notation IPv6 (`::ffff:a.b.c.d`, `::ffff:hhhh:hhhh`, `0:0:0:0:0:ffff:hhhh:hhhh`, zéros de tête, casse :
 * socket double pile) ramenée à sa forme IPv4 : sinon la blocklist et les clés de limite par IP ne reconnaîtraient pas
 * le même client. Autres adresses : inchangées.
 */
export function normalizeIp(ip: string): string {
  const g = expandIpv6(ip)
  if (!g) return ip
  if (g.slice(0, 5).every((v) => v === 0) && g[5] === 0xffff) {
    const hi = g[6] as number
    const lo = g[7] as number
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`
  }
  return ip
}

/**
 * Clé de limite de débit PAR IP (revue PR #18) : un client IPv6 dispose d'au moins un /64, donc la clé d'une IPv6 est son
 * préfixe /64 canonique (`<g1>:<g2>:<g3>:<g4>::/64`, minuscules, sans zéro de tête). IPv4 (y compris en notation IPv6) :
 * l'adresse IPv4. Pure ; ne remplace PAS l'adresse complète utilisée par la blocklist et l'audit.
 */
export function ipRateLimitKey(ip: string): string {
  const normalized = normalizeIp(ip)
  const g = expandIpv6(normalized)
  if (!g) return normalized
  return `${g
    .slice(0, 4)
    .map((v) => v.toString(16))
    .join(':')}::/64`
}

export function getClientIp(c: Context): string | null {
  const env = getEnv()
  const hops = env.TRUSTED_PROXY_HOPS

  if (hops > 0) {
    const xff = c.req.header('x-forwarded-for')
    if (xff) {
      const parts = xff.split(',').map((s) => s.trim())
      const idx = parts.length - hops
      if (idx >= 0) {
        const candidate = parts[idx]
        if (candidate && isIP(candidate)) return normalizeIp(candidate)
      }
    }
  }

  // Hors serveur Node (ex. `app.request()` sans liaisons) il n'y a pas de socket : IP inconnue, jamais une erreur.
  try {
    const addr = getConnInfo(c).remote.address
    return addr && isIP(addr) ? normalizeIp(addr) : null
  } catch {
    return null
  }
}
