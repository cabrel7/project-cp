import type { SmsMessage, SmsProvider } from './sms.provider.js'

/** Aucun fournisseur configuré : jamais de succès silencieux. */
export class UnavailableSmsProvider implements SmsProvider {
  readonly name = 'none'

  isAvailable(): boolean {
    return false
  }

  async send(_message: SmsMessage): Promise<void> {
    throw new Error('SMS provider unavailable')
  }
}
