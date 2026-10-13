import type { AuthMethodsResponse } from '@cp/shared'
import { getEnv } from '../../env.js'
import { isGoogleConfigured } from './oauth/google.client.js'

/**
 * Indicateurs figés (P-3, D67) : la clé d'accès et Apple n'existent pas côté serveur avant P8.8. Constantes de code,
 * volontairement non pilotables par une variable d'environnement.
 */
export const PASSKEY_ENABLED = false as const
export const APPLE_ENABLED = false as const

export function getAuthMethods(): AuthMethodsResponse {
  return {
    password: true,
    phone: getEnv().SMS_PROVIDER !== 'none',
    google: isGoogleConfigured(),
    passkey: PASSKEY_ENABLED,
    apple: APPLE_ENABLED,
  }
}
