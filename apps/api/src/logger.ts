import pino from 'pino'
import { getEnv } from './env.js'

export function createLogger() {
  const env = getEnv()
  return pino({
    name: 'api',
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
  })
}

export type Logger = pino.Logger
