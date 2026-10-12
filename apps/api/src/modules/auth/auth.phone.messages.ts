/**
 * Texte du SMS de connexion, bilingue. En code (comme les e-mails de P2.1) tant que le back-office
 * « Contenu » n'existe pas (`platform.message_templates` : dette notée). La marque est provisoire (D21).
 */
import { OTP_TTL_SECONDS } from './auth.phone.config.js'

const MINUTES = OTP_TTL_SECONDS / 60

export function otpSmsText(code: string, locale: 'fr' | 'en'): string {
  return locale === 'en'
    ? `${code} is your project-cp code. Valid for ${MINUTES} minutes. Do not share it with anyone.`
    : `${code} est votre code project-cp. Valable ${MINUTES} minutes. Ne le partagez avec personne.`
}

/** Nom de l'organisation personnelle quand la personne n'a pas donné son nom (jamais le numéro). */
export function defaultOrgName(locale: 'fr' | 'en'): string {
  return locale === 'en' ? 'My organization' : 'Mon organisation'
}
