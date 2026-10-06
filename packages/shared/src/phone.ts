/**
 * Téléphone — normalisation E.164, masquage, pays supportés (P2.2, spec §3.1).
 * Importable côté front comme côté back (aucune dépendance interne). Version complète de
 * libphonenumber-js (`/max`) : `getType` a besoin des métadonnées de type de ligne.
 */

import examples from 'libphonenumber-js/examples.mobile.json'
import {
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberWithError,
  validatePhoneNumberLength,
} from 'libphonenumber-js/max'
import { z } from 'zod'

/** Pays acceptés pour un numéro. Doit rester égal au seed SQL `ref.countries` (test de synchro). */
export const SUPPORTED_PHONE_COUNTRIES = [
  'CM',
  'GA',
  'CG',
  'TD',
  'CF',
  'GQ',
  'CI',
  'SN',
  'BJ',
  'TG',
  'BF',
  'ML',
  'FR',
  'BE',
  'US',
] as const

export type PhoneCountry = (typeof SUPPORTED_PHONE_COUNTRIES)[number]

export const phoneCountrySchema = z.enum(SUPPORTED_PHONE_COUNTRIES)

export type PhoneRejectReason =
  | 'NOT_A_NUMBER'
  | 'INVALID_COUNTRY'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'INVALID'
  | 'NOT_MOBILE'
  | 'COUNTRY_NOT_SUPPORTED'

export type NormalizePhoneResult =
  | { ok: true; e164: string; country: PhoneCountry }
  | { ok: false; reason: PhoneRejectReason; expectedLength?: number }

const SUPPORTED = new Set<string>(SUPPORTED_PHONE_COUNTRIES)
const SUPPORTED_CALLING_CODES = new Set<string>(
  SUPPORTED_PHONE_COUNTRIES.map((c) => getCountryCallingCode(c)),
)
/** Types de ligne qui peuvent recevoir un SMS. */
const SMS_CAPABLE_TYPES = new Set<string | undefined>(['MOBILE', 'FIXED_LINE_OR_MOBILE'])

function isSupportedCountry(country: string | undefined): country is PhoneCountry {
  return country !== undefined && SUPPORTED.has(country)
}

/** Longueur nationale d'un mobile du pays (exemple de la bibliothèque), pour guider la saisie. */
function expectedNationalLength(country: PhoneCountry): number | undefined {
  return getExampleNumber(country, examples)?.nationalNumber.length
}

/**
 * Normalise une saisie en E.164. Ne lève jamais ; ne renvoie jamais d'`e164` pour une entrée refusée.
 * Le préfixe international `00` est assimilé à `+`.
 */
export function normalizePhone(input: string, country: PhoneCountry): NormalizePhoneResult {
  const raw = input.trim().replace(/^00(?=\d)/, '+')
  try {
    const length = validatePhoneNumberLength(raw, country)
    if (length === 'NOT_A_NUMBER') return { ok: false, reason: 'NOT_A_NUMBER' }
    if (length === 'INVALID_COUNTRY') return { ok: false, reason: 'INVALID_COUNTRY' }
    if (length === 'TOO_LONG') return { ok: false, reason: 'TOO_LONG' }
    if (length === 'TOO_SHORT') {
      const expectedLength = expectedNationalLength(country)
      return expectedLength === undefined
        ? { ok: false, reason: 'TOO_SHORT' }
        : { ok: false, reason: 'TOO_SHORT', expectedLength }
    }
    const parsed = parsePhoneNumberWithError(raw, country)
    if (parsed.country !== undefined && !isSupportedCountry(parsed.country)) {
      return { ok: false, reason: 'COUNTRY_NOT_SUPPORTED' }
    }
    if (parsed.country === undefined && !SUPPORTED_CALLING_CODES.has(parsed.countryCallingCode)) {
      return { ok: false, reason: 'COUNTRY_NOT_SUPPORTED' }
    }
    if (length === 'INVALID_LENGTH' || !parsed.isValid() || !isSupportedCountry(parsed.country)) {
      return { ok: false, reason: 'INVALID' }
    }
    if (!SMS_CAPABLE_TYPES.has(parsed.getType())) return { ok: false, reason: 'NOT_MOBILE' }
    return { ok: true, e164: parsed.number, country: parsed.country }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'INVALID_COUNTRY') return { ok: false, reason: 'INVALID_COUNTRY' }
    if (message === 'TOO_SHORT') return { ok: false, reason: 'TOO_SHORT' }
    if (message === 'TOO_LONG') return { ok: false, reason: 'TOO_LONG' }
    return { ok: false, reason: 'NOT_A_NUMBER' }
  }
}

/** « +237 6 90 •• •• 42 » : indicatif, 3 premiers chiffres nationaux et 2 derniers (écran code SMS, logs dev). */
export function maskPhone(e164: string): string {
  try {
    const parsed = parsePhoneNumberWithError(e164)
    const national = parsed.nationalNumber
    const dial = `+${parsed.countryCallingCode}`
    if (national.length < 6)
      return `${dial} ${'•'.repeat(Math.max(national.length - 2, 0))}${national.slice(-2)}`
    const head = national.slice(0, 1)
    const next = national.slice(1, 3)
    const tail = national.slice(-2)
    const middle = '•'.repeat(national.length - 5).match(/.{1,2}/g) ?? []
    return [dial, head, next, ...middle, tail].join(' ')
  } catch {
    return '••••'
  }
}
