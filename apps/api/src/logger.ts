import pino from 'pino'
import { getEnv } from './env.js'

/**
 * Chemins masqués par pino (cp-security : aucune PII ni secret dans les journaux).
 * `*.x` couvre un niveau d'imbrication ; les champs de premier niveau (`code` d'erreur du catalogue,
 * `status`…) restent lisibles. Ne jamais journaliser de valeur brute de numéro, code, cookie ou jeton.
 */
export const LOG_REDACT_PATHS = [
  '*.phone',
  '*.phone_e164',
  '*.code',
  '*.password',
  '*.token',
  '*.secret',
  '*.apiKey',
  '*.cookie',
  '*.authorization',
  'phone',
  'phone_e164',
  'password',
  'token',
  'req.headers.cookie',
  'req.headers.authorization',
  'headers.cookie',
  'headers.authorization',
  'res.headers["set-cookie"]',
] as const

export function createLogger() {
  const env = getEnv()
  return pino({
    name: 'api',
    level: env.LOG_LEVEL,
    redact: { paths: [...LOG_REDACT_PATHS], censor: '[REDACTED]' },
    ...(env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
  })
}

export type Logger = pino.Logger
