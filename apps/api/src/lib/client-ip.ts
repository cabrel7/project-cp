import { isIP } from 'node:net'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'
import { getEnv } from '../env.js'

/**
 * IPv4 vue en notation IPv6 (`::ffff:a.b.c.d` ou `::ffff:hhhh:hhhh`, socket double pile) ramenée à sa forme IPv4 :
 * sinon la blocklist et les clés de limite par IP ne reconnaîtraient pas le même client. Autres adresses : inchangées.
 */
export function normalizeIp(ip: string): string {
  if (isIP(ip) !== 6) return ip
  const dotted = /^(?:0{0,4}:){2,5}ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip)
  if (dotted?.[1] && isIP(dotted[1]) === 4) return dotted[1]
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip)
  if (hex?.[1] && hex[2]) {
    const hi = Number.parseInt(hex[1], 16)
    const lo = Number.parseInt(hex[2], 16)
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`
  }
  return ip
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
