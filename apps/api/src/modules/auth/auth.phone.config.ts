/**
 * Limites et réglages de l'authentification par téléphone (spec P2.2 §3.4, valeurs D60 : « telles quelles »).
 * Constantes typées, injectables pour les tests (`setPhoneConfig` / `resetPhoneConfig`) ; elles pourront
 * plus tard venir de `platform.rate_limit_policies` (dette notée dans PROJECT_STATE).
 * Les fonctions de lecture sont appelées à CHAQUE requête : une valeur injectée est prise en compte
 * immédiatement, sans reconstruire l'application.
 */

export interface PhoneConfig {
  /** Délai de renvoi par numéro (1 demande / N s). 0 désactive ce limiteur. */
  resendDelaySeconds: number
  /** Demandes de code par numéro et par heure. */
  requestPerPhonePerHour: number
  /** Demandes de code par IP (plage large : CGNAT des opérateurs mobiles). */
  requestPerIp: number
  /** Fenêtre (s) des limites par IP et des vérifications. */
  windowSeconds: number
  /** Vérifications par numéro sur la fenêtre. */
  verifyPerPhone: number
  /** Vérifications par IP sur la fenêtre. */
  verifyPerIp: number
  /** Région de données de l'organisation personnelle créée à l'inscription. */
  dataRegionCode: string
}

/** Durée de vie d'un code, en secondes (colonne `expires_at` calculée côté SQL). */
export const OTP_TTL_SECONDS = 300

/** Essais maximum par code (colonne `max_attempts`, valeur par défaut de la table). */
export const OTP_MAX_ATTEMPTS = 5

const DEFAULTS: Readonly<PhoneConfig> = {
  resendDelaySeconds: 60,
  requestPerPhonePerHour: 5,
  requestPerIp: 20,
  windowSeconds: 900,
  verifyPerPhone: 10,
  verifyPerIp: 60,
  dataRegionCode: 'eu-fr',
}

let overrides: Partial<PhoneConfig> = {}

export function getPhoneConfig(): PhoneConfig {
  return { ...DEFAULTS, ...overrides }
}

export function setPhoneConfig(partial: Partial<PhoneConfig>): void {
  overrides = { ...overrides, ...partial }
}

export function resetPhoneConfig(): void {
  overrides = {}
}
