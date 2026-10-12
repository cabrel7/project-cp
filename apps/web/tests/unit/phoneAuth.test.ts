import { describe, expect, it } from 'vitest'
import { AuthError } from '../../app/composables/useAuth'
import { authErrorKey, authErrorParams, isPhoneValidationError } from '../../app/utils/authErrors'
import {
  clearPhoneRequest,
  formatClock,
  formatWait,
  loadPhoneRequest,
  missingDigits,
  PHONE_REQUEST_STORAGE_KEY,
  type PhoneRequestState,
  phoneReasonKey,
  savePhoneRequest,
  secondsUntil,
} from '../../app/utils/phoneAuth'

class MemoryStorage {
  private data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
}

const state: PhoneRequestState = {
  e164: '+237690123442',
  country: 'CM',
  intent: 'register',
  fullName: 'Awa Nkeng',
  expiresAt: 1_000_300_000,
  resendAt: 1_000_060_000,
}

describe('demande de code en sessionStorage', () => {
  it('doit relire la demande enregistrée', () => {
    const s = new MemoryStorage()
    savePhoneRequest(s, state)
    expect(loadPhoneRequest(s)).toEqual(state)
  })

  it('ne doit jamais conserver un code, même ajouté au stockage', () => {
    const s = new MemoryStorage()
    s.setItem(PHONE_REQUEST_STORAGE_KEY, JSON.stringify({ ...state, code: '270512' }))
    const loaded = loadPhoneRequest(s)
    expect(JSON.stringify(loaded)).not.toContain('270512')
    savePhoneRequest(s, { ...state, code: '270512' } as PhoneRequestState)
    expect(s.getItem(PHONE_REQUEST_STORAGE_KEY)).not.toContain('270512')
  })

  it('doit ignorer et effacer une valeur altérée ou illisible', () => {
    const s = new MemoryStorage()
    s.setItem(PHONE_REQUEST_STORAGE_KEY, '{pas du json')
    expect(loadPhoneRequest(s)).toBeNull()
    s.setItem(PHONE_REQUEST_STORAGE_KEY, JSON.stringify({ ...state, e164: 'abc' }))
    expect(loadPhoneRequest(s)).toBeNull()
    expect(s.getItem(PHONE_REQUEST_STORAGE_KEY)).toBeNull()
  })

  it('doit effacer la demande', () => {
    const s = new MemoryStorage()
    savePhoneRequest(s, state)
    clearPhoneRequest(s)
    expect(loadPhoneRequest(s)).toBeNull()
  })
})

describe('compte à rebours', () => {
  it('doit compter les secondes restantes sans valeur négative', () => {
    expect(secondsUntil(61_000, 1_000)).toBe(60)
    expect(secondsUntil(61_000, 60_500)).toBe(1)
    expect(secondsUntil(61_000, 90_000)).toBe(0)
  })
  it('doit formater en m:ss', () => {
    expect(formatClock(42)).toBe('0:42')
    expect(formatClock(60)).toBe('1:00')
    expect(formatClock(-3)).toBe('0:00')
  })
  it('doit formater une durée de 429 lisible', () => {
    const t = (key: string, params?: Record<string, unknown>) => `${key}:${JSON.stringify(params)}`
    expect(formatWait(45, t)).toContain('duration.seconds')
    expect(formatWait(120, t)).toContain('duration.minutes:{"n":2}')
    expect(formatWait(90, t)).toContain('duration.minutesSeconds:{"m":1,"s":30}')
  })
})

describe('aide à la saisie', () => {
  it('doit compter les chiffres manquants (maquette 05 : 7 saisis sur 9)', () => {
    expect(missingDigits('6 90 12 34', '+237', 9)).toBe(2)
    expect(missingDigits('+237 6 90 12', '+237', 9)).toBe(4)
    expect(missingDigits('0023769012345', '+237', 9)).toBe(1)
    expect(missingDigits('690123456', '+237', 9)).toBe(1)
  })
  it('doit associer une raison de refus à une clé i18n', () => {
    expect(phoneReasonKey('TOO_SHORT')).toBe('cp.auth.phone.errors.tooShort')
    expect(phoneReasonKey('NOT_MOBILE')).toBe('cp.auth.phone.errors.notMobile')
    expect(phoneReasonKey('NOT_A_NUMBER')).toBe('cp.auth.phone.errors.invalid')
    expect(phoneReasonKey(undefined)).toBe('cp.auth.phone.errors.invalid')
  })
})

describe('authErrors (téléphone)', () => {
  it('doit mapper les codes OTP et SMS', () => {
    expect(authErrorKey(new AuthError('AUTH_OTP_INVALID', 422))).toBe('cp.auth.code.invalid')
    expect(authErrorKey(new AuthError('AUTH_OTP_EXPIRED', 422))).toBe('cp.auth.code.expired')
    expect(authErrorKey(new AuthError('AUTH_OTP_ATTEMPTS_EXCEEDED', 422))).toBe(
      'cp.auth.code.tooManyAttempts',
    )
    expect(authErrorKey(new AuthError('AUTH_SMS_UNAVAILABLE', 503))).toBe(
      'cp.auth.code.smsUnavailable',
    )
    expect(authErrorKey(new AuthError('PLATFORM_RATE_LIMIT', 429))).toBe('cp.auth.rateLimited')
  })
  it('doit lire remaining_attempts pour le pluriel', () => {
    const e = new AuthError('AUTH_OTP_INVALID', 422, 'req_1', { remaining_attempts: 3 })
    expect(authErrorParams(e)).toEqual({ params: { count: 3 }, plural: 3 })
  })
  it('doit lire reason et expected_length d une erreur de validation téléphone', () => {
    const e = new AuthError('PLATFORM_VALIDATION_ERROR', 422, undefined, {
      field: 'phone',
      reason: 'TOO_SHORT',
      expected_length: 9,
    })
    expect(isPhoneValidationError(e)).toBe(true)
    expect(authErrorKey(e)).toBe('cp.auth.phone.errors.tooShort')
    expect(authErrorParams(e, { countryName: 'Cameroun' }).params).toEqual({
      n: 9,
      country: 'Cameroun',
    })
  })
  it('doit garder un message générique pour une autre validation', () => {
    const e = new AuthError('PLATFORM_VALIDATION_ERROR', 422, undefined, { field: 'email' })
    expect(isPhoneValidationError(e)).toBe(false)
    expect(authErrorKey(e)).toBe('cp.auth.genericError')
  })
})
