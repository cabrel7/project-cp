import { maskPhone } from '@cp/shared'
import { getEnv } from '../../../env.js'
import { createLogger, type Logger } from '../../../logger.js'
import type { SmsMessage, SmsProvider } from './sms.provider.js'

export interface SimulatedSms {
  to: string
  text: string
  sentAt: Date
}

/** Boîte mémoire (dev et test) : seul endroit où un test lit le code, qui n'est jamais stocké en clair en base. */
const OUTBOX_MAX = 1000
const outbox: SimulatedSms[] = []

export function getSimulatedOutbox(): readonly SimulatedSms[] {
  return outbox
}

export function clearSimulatedOutbox(): void {
  outbox.length = 0
}

/** Sous-ensemble de pino utilisé ici ; chaque méthode est facultative (un journal partiel est toléré). */
export type SimulatedSmsLogger = Partial<Pick<Logger, 'info' | 'warn'>>

export interface SimulatedSmsProviderOptions {
  nodeEnv?: 'development' | 'production' | 'test'
  logger?: SimulatedSmsLogger
}

/**
 * Fournisseur simulé : INTERDIT en production (défense en profondeur, en plus de la validation de
 * `env.ts`). Le code n'est journalisé qu'en `development`, masqué côté numéro, avec un avertissement.
 */
export class SimulatedSmsProvider implements SmsProvider {
  readonly name = 'simulated'
  private readonly nodeEnv: 'development' | 'production' | 'test'
  private readonly logger: SimulatedSmsLogger | undefined

  constructor(options: SimulatedSmsProviderOptions = {}) {
    this.nodeEnv = options.nodeEnv ?? getEnv().NODE_ENV
    if (this.nodeEnv === 'production') {
      throw new Error('SimulatedSmsProvider must never be used when NODE_ENV=production')
    }
    this.logger = options.logger
  }

  isAvailable(): boolean {
    return true
  }

  async send(message: SmsMessage): Promise<void> {
    outbox.push({ to: message.to, text: message.text, sentAt: new Date() })
    if (outbox.length > OUTBOX_MAX) outbox.splice(0, outbox.length - OUTBOX_MAX)

    if (this.nodeEnv !== 'development') return
    const logger = this.logger ?? createLogger()
    const code = message.text.match(/(?<!\d)(\d{6})(?!\d)/)?.[1]
    logger.warn?.('SMS simulé : le code est journalisé (dev only, jamais en production)')
    logger.info?.({ phone_masked: maskPhone(message.to), code }, 'SMS simulé envoyé (dev only)')
  }
}
