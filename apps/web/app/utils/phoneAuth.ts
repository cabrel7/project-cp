// Logique pure de la connexion par téléphone (P2.2) : demande en cours, compte à rebours, aide à la saisie.
// Aucune dépendance Nuxt ni libphonenumber : testable en Vitest simple, chargée sans retarder la page.

export type PhoneIntent = 'login' | 'register'

/** Demande de code en cours. Le code saisi n'en fait JAMAIS partie (ni stockage, ni journal). */
export interface PhoneRequestState {
  e164: string
  country: string
  intent: PhoneIntent
  fullName?: string
  /** Horodatages absolus (ms) : un rechargement ne remet pas les compteurs à zéro. */
  expiresAt: number
  resendAt: number
}

export const PHONE_REQUEST_STORAGE_KEY = 'cp.phoneAuth.request'

type ReadableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function isRequestState(value: unknown): value is PhoneRequestState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.e164 === 'string' &&
    /^\+[0-9]{6,15}$/.test(v.e164) &&
    typeof v.country === 'string' &&
    (v.intent === 'login' || v.intent === 'register') &&
    (v.fullName === undefined || typeof v.fullName === 'string') &&
    typeof v.expiresAt === 'number' &&
    typeof v.resendAt === 'number'
  )
}

/** Relit la demande ; toute valeur absente ou altérée est ignorée (et effacée). */
export function loadPhoneRequest(storage: ReadableStorage): PhoneRequestState | null {
  try {
    const raw = storage.getItem(PHONE_REQUEST_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (isRequestState(parsed)) {
      // Reconstruit l'objet : aucun champ inattendu (ex. un « code ») ne survit.
      const { e164, country, intent, fullName, expiresAt, resendAt } = parsed
      return { e164, country, intent, ...(fullName ? { fullName } : {}), expiresAt, resendAt }
    }
  } catch {
    // JSON illisible : traité comme une demande absente.
  }
  storage.removeItem(PHONE_REQUEST_STORAGE_KEY)
  return null
}

export function savePhoneRequest(storage: ReadableStorage, state: PhoneRequestState): void {
  const { e164, country, intent, fullName, expiresAt, resendAt } = state
  storage.setItem(
    PHONE_REQUEST_STORAGE_KEY,
    JSON.stringify({
      e164,
      country,
      intent,
      ...(fullName ? { fullName } : {}),
      expiresAt,
      resendAt,
    }),
  )
}

export function clearPhoneRequest(storage: ReadableStorage): void {
  storage.removeItem(PHONE_REQUEST_STORAGE_KEY)
}

/** Secondes restantes (arrondi au supérieur, jamais négatif). */
export function secondsUntil(target: number, now: number): number {
  return Math.max(0, Math.ceil((target - now) / 1000))
}

/** « 0:42 » */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

type Translate = (key: string, params?: Record<string, unknown>, plural?: number) => string

/** Durée lisible pour un 429 : « 45 secondes », « 2 minutes », « 1 min 30 s ». */
export function formatWait(totalSeconds: number, t: Translate): string {
  const total = Math.max(1, Math.ceil(totalSeconds))
  if (total < 60) return t('cp.auth.duration.seconds', { n: total }, total)
  const m = Math.floor(total / 60)
  const s = total % 60
  if (s === 0) return t('cp.auth.duration.minutes', { n: m }, m)
  return t('cp.auth.duration.minutesSeconds', { m, s })
}

/**
 * Nombre de chiffres qui manquent pour atteindre la longueur nationale attendue (au moins 1).
 * Un préfixe international (`+237…`, `00237…`) n'est pas compté comme chiffres du numéro.
 */
export function missingDigits(input: string, dialCode: string, expectedLength: number): number {
  const trimmed = input.trim()
  let digits = trimmed.replace(/\D/g, '')
  const dial = dialCode.replace(/\D/g, '')
  if (trimmed.startsWith('+') && digits.startsWith(dial)) digits = digits.slice(dial.length)
  else if (trimmed.startsWith('00') && digits.startsWith(`00${dial}`))
    digits = digits.slice(2 + dial.length)
  return Math.max(1, expectedLength - digits.length)
}

/** Raison de refus d'un numéro (client ou serveur) -> clé i18n. */
const PHONE_REASON_KEYS: Record<string, string> = {
  TOO_SHORT: 'cp.auth.phone.errors.tooShort',
  TOO_LONG: 'cp.auth.phone.errors.tooLong',
  NOT_MOBILE: 'cp.auth.phone.errors.notMobile',
  COUNTRY_NOT_SUPPORTED: 'cp.auth.phone.errors.countryNotSupported',
  INVALID_COUNTRY: 'cp.auth.phone.errors.countryNotSupported',
}

export function phoneReasonKey(reason: string | undefined): string {
  return reason && Object.hasOwn(PHONE_REASON_KEYS, reason)
    ? (PHONE_REASON_KEYS[reason] ?? 'cp.auth.phone.errors.invalid')
    : 'cp.auth.phone.errors.invalid'
}
