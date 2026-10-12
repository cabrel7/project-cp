/**
 * P2.2 — logique pure du parcours téléphone, cas limites (complète phoneAuth.test.ts) :
 * demande en sessionStorage, compte à rebours aux bornes, durées lisibles, aide à la saisie, clés i18n.
 * Les tests « [DÉFAUT OUVERT] » décrivent le comportement attendu et sont ROUGES tant que le code n'est pas corrigé.
 */
import { describe, expect, it } from 'vitest'
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
  data = new Map<string, string>()
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
  intent: 'login',
  expiresAt: 1_000_300_000,
  resendAt: 1_000_060_000,
}

describe('demande de code en sessionStorage — validation', () => {
  it.each([
    ['intention inconnue', { ...state, intent: 'admin' }],
    ['pays non textuel', { ...state, country: 237 }],
    ['expiresAt en texte', { ...state, expiresAt: '1000300000' }],
    ['resendAt absent', { ...state, resendAt: undefined }],
    ['numéro avec espaces', { ...state, e164: '+237 690 123 442' }],
    ['numéro sans plus', { ...state, e164: '237690123442' }],
    ['numéro trop court', { ...state, e164: '+12345' }],
    ['numéro trop long', { ...state, e164: '+1234567890123456' }],
    ['fullName non textuel', { ...state, fullName: 42 }],
    ['null', null],
    ['tableau', [state]],
    ['nombre', 5],
    ['chaîne', 'x'],
  ])('doit ignorer et effacer une demande invalide (%s)', (_label, value) => {
    const s = new MemoryStorage()
    s.setItem(PHONE_REQUEST_STORAGE_KEY, JSON.stringify(value))
    expect(loadPhoneRequest(s)).toBeNull()
    expect(s.getItem(PHONE_REQUEST_STORAGE_KEY)).toBeNull()
  })

  it('doit renvoyer null sans rien effacer quand aucune demande n’est stockée', () => {
    const s = new MemoryStorage()
    expect(loadPhoneRequest(s)).toBeNull()
    s.setItem(PHONE_REQUEST_STORAGE_KEY, '')
    expect(loadPhoneRequest(s)).toBeNull()
  })

  it('doit traiter un stockage qui lève une exception en lecture comme une demande absente', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {},
      removeItem: () => {},
    }
    expect(loadPhoneRequest(broken)).toBeNull()
  })

  it('doit ne relire que les champs connus (aucun champ inattendu ne survit : code, jeton…)', () => {
    const s = new MemoryStorage()
    s.setItem(
      PHONE_REQUEST_STORAGE_KEY,
      JSON.stringify({ ...state, code: '270512', otp: '270512', token: 'abc', session: 'x' }),
    )
    const loaded = loadPhoneRequest(s)
    expect(Object.keys(loaded ?? {}).sort()).toEqual(
      ['country', 'e164', 'expiresAt', 'intent', 'resendAt'].sort(),
    )
  })

  it('doit écrire uniquement les champs connus et omettre fullName vide ou absent', () => {
    const s = new MemoryStorage()
    savePhoneRequest(s, { ...state, fullName: '' })
    expect(JSON.parse(s.getItem(PHONE_REQUEST_STORAGE_KEY) ?? '{}')).toEqual(state)
    savePhoneRequest(s, {
      ...state,
      fullName: 'Awa',
      otp: '123456',
      password: 'x',
    } as PhoneRequestState)
    const written = s.getItem(PHONE_REQUEST_STORAGE_KEY) ?? ''
    expect(JSON.parse(written)).toEqual({ ...state, fullName: 'Awa' })
    expect(written).not.toContain('123456')
    expect(written).not.toContain('password')
  })

  it('doit écrire sous une seule clé et laisser les autres clés du stockage intactes', () => {
    const s = new MemoryStorage()
    s.setItem('autre', 'valeur')
    savePhoneRequest(s, state)
    clearPhoneRequest(s)
    expect([...s.data.keys()]).toEqual(['autre'])
  })

  it('doit relire une demande dont les horodatages sont périmés : le serveur reste l’autorité (AUTH_OTP_EXPIRED)', () => {
    // CARACTÉRISATION : `loadPhoneRequest` ne compare jamais `expiresAt` à l'horloge. Une demande périmée est
    // restaurée ; l'écran du code affiche alors l'erreur du serveur (« Ce code a expiré ») à la vérification.
    // Si l'équipe décide qu'une demande périmée doit être « absente » (redirection vers la connexion), inverser ce test.
    const s = new MemoryStorage()
    const stale = { ...state, expiresAt: 1, resendAt: 1 }
    savePhoneRequest(s, stale)
    expect(loadPhoneRequest(s)).toEqual(stale)
    expect(secondsUntil(stale.expiresAt, Date.now())).toBe(0)
    expect(secondsUntil(stale.resendAt, Date.now())).toBe(0)
  })
})

describe('compte à rebours — bornes', () => {
  const resendAt = 100_000
  it.each([
    [resendAt - 60_000, 60], // juste après la demande : 60 s
    [resendAt - 59_999, 60], // 1 ms plus tard : toujours 60 (arrondi au supérieur)
    [resendAt - 59_000, 59],
    [resendAt - 1_001, 2],
    [resendAt - 1_000, 1],
    [resendAt - 1, 1], // 1 ms avant l'échéance : encore 1 s, pas de renvoi possible
    [resendAt, 0], // à l'échéance : renvoi possible
    [resendAt + 1, 0],
    [resendAt + 3_600_000, 0], // jamais négatif
  ])('à %i ms : %i s restantes', (now, expected) => {
    expect(secondsUntil(resendAt, now)).toBe(expected)
  })

  it('doit rester à 0 pour une échéance invalide ou déjà passée', () => {
    expect(secondsUntil(0, 5_000)).toBe(0)
    expect(secondsUntil(-1, 5_000)).toBe(0)
  })

  it.each([
    [0, '0:00'],
    [1, '0:01'],
    [59, '0:59'],
    [61, '1:01'],
    [300, '5:00'],
    [3599, '59:59'],
    [3600, '60:00'],
    [42.9, '0:42'],
    [-1, '0:00'],
  ])('formatClock(%d) = %s', (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected)
  })
})

describe('formatWait (429 + Retry-After)', () => {
  const t = (key: string, params?: Record<string, unknown>, plural?: number) =>
    `${key}|${JSON.stringify(params)}|${plural ?? ''}`

  it.each([
    [0, 'cp.auth.duration.seconds|{"n":1}|1'], // jamais « 0 seconde »
    [-5, 'cp.auth.duration.seconds|{"n":1}|1'],
    [0.2, 'cp.auth.duration.seconds|{"n":1}|1'],
    [1, 'cp.auth.duration.seconds|{"n":1}|1'],
    [59, 'cp.auth.duration.seconds|{"n":59}|59'],
    [59.1, 'cp.auth.duration.minutes|{"n":1}|1'], // arrondi au supérieur : 60 s = 1 minute
    [60, 'cp.auth.duration.minutes|{"n":1}|1'],
    [61, 'cp.auth.duration.minutesSeconds|{"m":1,"s":1}|'],
    [90, 'cp.auth.duration.minutesSeconds|{"m":1,"s":30}|'],
    [120, 'cp.auth.duration.minutes|{"n":2}|2'],
    [900, 'cp.auth.duration.minutes|{"n":15}|15'],
    [3600, 'cp.auth.duration.minutes|{"n":60}|60'],
  ])('formatWait(%d)', (seconds, expected) => {
    expect(formatWait(seconds, t)).toBe(expected)
  })
})

describe('missingDigits — aide à la saisie', () => {
  it.each([
    ['', '+237', 9, 9],
    ['   ', '+237', 9, 9],
    ['+237', '+237', 9, 9],
    ['00237', '+237', 9, 9],
    ['6', '+237', 9, 8],
    ['690123442', '+237', 9, 1], // complet : au moins 1 (l'aide n'est affichée que si le numéro est refusé)
    ['6901234421234', '+237', 9, 1], // trop long : jamais négatif
    ['6-90.12 34(4)', '+237', 9, 1], // séparateurs ignorés (8 chiffres)
    ['6-90.12 3', '+237', 9, 3], // séparateurs ignorés (6 chiffres)
    ['abc 69 01', '+237', 9, 5], // lettres ignorées
    ['+237 690 12', '237', 9, 4], // indicatif donné sans « + »
    ['+33 6 12 34', '+237', 9, 2], // autre indicatif : tous les chiffres comptent (7)
    ['237 690 12', '+237', 9, 1], // « 237… » sans + ni 00 : 8 chiffres nationaux
  ])('missingDigits(%j, %s, %d) = %d', (input, dial, expected, result) => {
    expect(missingDigits(input, dial, expected)).toBe(result)
  })
})

describe('phoneReasonKey — toutes les raisons du serveur', () => {
  it.each([
    ['TOO_SHORT', 'cp.auth.phone.errors.tooShort'],
    ['TOO_LONG', 'cp.auth.phone.errors.tooLong'],
    ['NOT_MOBILE', 'cp.auth.phone.errors.notMobile'],
    ['COUNTRY_NOT_SUPPORTED', 'cp.auth.phone.errors.countryNotSupported'],
    ['INVALID_COUNTRY', 'cp.auth.phone.errors.countryNotSupported'],
    ['NOT_A_NUMBER', 'cp.auth.phone.errors.invalid'],
    ['INVALID', 'cp.auth.phone.errors.invalid'],
    ['RAISON_INCONNUE', 'cp.auth.phone.errors.invalid'],
    ['', 'cp.auth.phone.errors.invalid'],
    ['too_short', 'cp.auth.phone.errors.invalid'], // la casse compte
  ])('phoneReasonKey(%j) = %s', (reason, expected) => {
    expect(phoneReasonKey(reason)).toBe(expected)
  })

  it.each(['toString', 'constructor', '__proto__', 'hasOwnProperty'])(
    '[DÉFAUT OUVERT] phoneReasonKey(%j) renvoie la clé générique, jamais une propriété héritée de Object',
    (reason) => {
      // `PHONE_REASON_KEYS[reason]` lit le prototype : une raison hostile renvoie une fonction au lieu d'une clé i18n.
      expect(phoneReasonKey(reason)).toBe('cp.auth.phone.errors.invalid')
    },
  )
})
