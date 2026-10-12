/** Message SMS sortant. `signal` borne la durée de l'envoi (le service impose 5 s). */
export interface SmsMessage {
  to: string
  text: string
  signal?: AbortSignal
}

/**
 * Frontière externe d'envoi de SMS. Implémentations : `simulated` (dev et test seulement) et `none`
 * (aucun fournisseur : tout envoi échoue, le service répond 503 `AUTH_SMS_UNAVAILABLE`).
 */
export interface SmsProvider {
  readonly name: string
  isAvailable(): boolean
  send(message: SmsMessage): Promise<void>
}
