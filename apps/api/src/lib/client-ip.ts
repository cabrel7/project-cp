import { isIP } from 'node:net'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'
import { getEnv } from '../env.js'

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
        if (candidate && isIP(candidate)) return candidate
      }
    }
  }

  // Hors serveur Node (ex. `app.request()` sans liaisons) il n'y a pas de socket : IP inconnue, jamais une erreur.
  try {
    const addr = getConnInfo(c).remote.address
    return addr && isIP(addr) ? addr : null
  } catch {
    return null
  }
}
