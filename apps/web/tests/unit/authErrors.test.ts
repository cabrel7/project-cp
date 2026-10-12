/**
 * P2.2 — mapping des erreurs API vers l'interface (authErrors.ts) et normalisation `toAuthError` (useAuth.ts).
 * Règle : jamais le message brut du serveur ; 429 avec Retry-After ; 503 SMS indisponible ; essais restants.
 * Les tests « [DÉFAUT OUVERT] » sont ROUGES tant que le code n'est pas corrigé.
 */
import { describe, expect, it } from 'vitest'
import { AuthError, toAuthError } from '../../app/composables/useAuth'
import { authErrorKey, authErrorParams, isPhoneValidationError } from '../../app/utils/authErrors'
import { formatWait } from '../../app/utils/phoneAuth'

const err = (code: string, status: number, details: Record<string, unknown> = {}) =>
  new AuthError(code, status, 'req_1', details)

describe('authErrorKey — codes du catalogue', () => {
  it.each([
    ['AUTH_INVALID_CREDENTIALS', 401, 'cp.auth.login.invalidCredentials'],
    ['AUTH_EMAIL_ALREADY_EXISTS', 409, 'cp.auth.register.emailExists'],
    ['AUTH_PASSWORD_TOO_WEAK', 422, 'cp.auth.register.passwordWeak'],
    ['AUTH_VERIFICATION_TOKEN_EXPIRED', 422, 'cp.auth.reset.invalidToken'],
    ['AUTH_VERIFICATION_TOKEN_INVALID', 422, 'cp.auth.reset.invalidToken'],
    ['AUTH_SIGNUP_CLOSED', 403, 'cp.auth.signupClosed'],
    ['AUTH_ACCOUNT_SUSPENDED', 403, 'cp.auth.accountSuspended'],
    ['AUTH_OTP_INVALID', 422, 'cp.auth.code.invalid'],
    ['AUTH_OTP_EXPIRED', 422, 'cp.auth.code.expired'],
    ['AUTH_OTP_ATTEMPTS_EXCEEDED', 422, 'cp.auth.code.tooManyAttempts'],
    ['AUTH_SMS_UNAVAILABLE', 503, 'cp.auth.code.smsUnavailable'],
    ['PLATFORM_RATE_LIMIT', 429, 'cp.auth.rateLimited'],
  ])('%s (%d) → %s', (code, status, key) => {
    expect(authErrorKey(err(code, status))).toBe(key)
  })

  it('doit afficher « trop de demandes » pour tout 429, quel que soit le code', () => {
    expect(authErrorKey(err('UNKNOWN', 429))).toBe('cp.auth.rateLimited')
    expect(authErrorKey(err('AUTH_OTP_INVALID', 429))).toBe('cp.auth.rateLimited')
  })

  it('doit donner la clé générique pour un code inconnu, un 5xx quelconque, une erreur réseau ou une valeur non-AuthError', () => {
    expect(authErrorKey(err('PLATFORM_INTERNAL_ERROR', 500))).toBe('cp.auth.genericError')
    expect(authErrorKey(err('PLATFORM_MAINTENANCE', 503))).toBe('cp.auth.genericError')
    expect(authErrorKey(err('UNKNOWN', 0))).toBe('cp.auth.genericError')
    expect(authErrorKey(new Error('boom'))).toBe('cp.auth.genericError')
    expect(authErrorKey(null)).toBe('cp.auth.genericError')
    expect(authErrorKey('AUTH_OTP_INVALID')).toBe('cp.auth.genericError')
  })

  it('ne doit jamais renvoyer le message brut du serveur ni le code brut', () => {
    const e = new AuthError('AUTH_OTP_INVALID', 422, 'req_1', { message: 'Incorrect code 270512' })
    expect(authErrorKey(e)).not.toContain('270512')
    expect(authErrorKey(e).startsWith('cp.auth.')).toBe(true)
  })

  it.each(['constructor', 'toString', '__proto__'])(
    '[DÉFAUT OUVERT] un code d’erreur hostile (%j) donne la clé générique, jamais une propriété héritée de Object',
    (code) => {
      expect(authErrorKey(err(code, 400))).toBe('cp.auth.genericError')
    },
  )
})

describe('authErrorKey — validation du numéro (422 field=phone)', () => {
  const phone = (reason?: string, extra: Record<string, unknown> = {}) =>
    err('PLATFORM_VALIDATION_ERROR', 422, {
      field: 'phone',
      ...(reason ? { reason } : {}),
      ...extra,
    })

  it.each([
    ['TOO_SHORT', 'cp.auth.phone.errors.tooShort'],
    ['TOO_LONG', 'cp.auth.phone.errors.tooLong'],
    ['NOT_MOBILE', 'cp.auth.phone.errors.notMobile'],
    ['COUNTRY_NOT_SUPPORTED', 'cp.auth.phone.errors.countryNotSupported'],
    ['NOT_A_NUMBER', 'cp.auth.phone.errors.invalid'],
  ])('raison %s → %s', (reason, key) => {
    expect(isPhoneValidationError(phone(reason))).toBe(true)
    expect(authErrorKey(phone(reason))).toBe(key)
  })

  it('doit retomber sur « numéro invalide » sans raison ou avec une raison non textuelle', () => {
    expect(authErrorKey(phone())).toBe('cp.auth.phone.errors.invalid')
    expect(authErrorKey(err('PLATFORM_VALIDATION_ERROR', 422, { field: 'phone', reason: 5 }))).toBe(
      'cp.auth.phone.errors.invalid',
    )
  })

  it('ne doit pas traiter comme erreur de téléphone une validation d’un autre champ ou un autre code', () => {
    expect(isPhoneValidationError(err('PLATFORM_VALIDATION_ERROR', 422, { field: 'code' }))).toBe(
      false,
    )
    expect(isPhoneValidationError(err('AUTH_OTP_INVALID', 422, { field: 'phone' }))).toBe(false)
    expect(isPhoneValidationError(new Error('x'))).toBe(false)
    expect(isPhoneValidationError(undefined)).toBe(false)
  })
})

describe('authErrorParams — essais restants et chiffres manquants', () => {
  it.each([
    [4, 4],
    [1, 1],
    [0, 0],
    ['2', 2], // valeur sérialisée en texte
  ])('AUTH_OTP_INVALID avec remaining_attempts=%j → count=%d (pluriel inclus)', (raw, count) => {
    expect(authErrorParams(err('AUTH_OTP_INVALID', 422, { remaining_attempts: raw }))).toEqual({
      params: { count },
      plural: count,
    })
  })

  it.each([[undefined], [-1], ['abc'], [null]])(
    'AUTH_OTP_INVALID avec remaining_attempts=%j → 0 essai (jamais NaN ni négatif)',
    (raw) => {
      const details = raw === undefined ? {} : { remaining_attempts: raw }
      const r = authErrorParams(err('AUTH_OTP_INVALID', 422, details))
      expect(r.params.count).toBe(0)
      expect(r.plural).toBe(0)
    },
  )

  it('TOO_SHORT : n = longueur attendue, pays nommé ; sans longueur : n vide ; sans pays : vide', () => {
    const e = err('PLATFORM_VALIDATION_ERROR', 422, {
      field: 'phone',
      reason: 'TOO_SHORT',
      expected_length: 9,
    })
    expect(authErrorParams(e, { countryName: 'Cameroun' })).toEqual({
      params: { n: 9, country: 'Cameroun' },
      plural: 1,
    })
    expect(authErrorParams(e).params).toEqual({ n: 9, country: '' })
    const noLen = err('PLATFORM_VALIDATION_ERROR', 422, { field: 'phone', reason: 'TOO_SHORT' })
    // Number(undefined) = NaN → champ vide plutôt que « NaN » affiché à l'écran
    expect(authErrorParams(noLen).params.n).toBe('')
  })

  it('autres erreurs ou valeurs : aucun paramètre', () => {
    expect(authErrorParams(err('AUTH_OTP_EXPIRED', 422))).toEqual({ params: {} })
    expect(authErrorParams(err('AUTH_SMS_UNAVAILABLE', 503))).toEqual({ params: {} })
    expect(authErrorParams(err('PLATFORM_RATE_LIMIT', 429))).toEqual({ params: {} })
    expect(
      authErrorParams(
        err('PLATFORM_VALIDATION_ERROR', 422, { field: 'phone', reason: 'NOT_MOBILE' }),
      ),
    ).toEqual({ params: {} })
    expect(authErrorParams(new Error('x'))).toEqual({ params: {} })
    expect(authErrorParams(null)).toEqual({ params: {} })
  })
})

describe('toAuthError', () => {
  const fetchError = (opts: {
    status?: number
    statusCode?: number
    data?: unknown
    retryAfter?: string | null
  }) => ({
    ...(opts.status === undefined ? {} : { status: opts.status }),
    ...(opts.statusCode === undefined ? {} : { statusCode: opts.statusCode }),
    data: opts.data,
    response: {
      headers: { get: (n: string) => (n === 'retry-after' ? (opts.retryAfter ?? null) : null) },
    },
  })

  it('doit normaliser une réponse d’erreur du catalogue (code, statut, request_id, details)', () => {
    const e = toAuthError(
      fetchError({
        statusCode: 422,
        data: {
          error: {
            code: 'AUTH_OTP_INVALID',
            request_id: 'req_9',
            details: { remaining_attempts: 3 },
          },
        },
      }),
    )
    expect(e).toBeInstanceOf(AuthError)
    expect(e).toBeInstanceOf(Error)
    expect(e.name).toBe('AuthError')
    expect(e.message).toBe('AUTH_OTP_INVALID')
    expect(e.code).toBe('AUTH_OTP_INVALID')
    expect(e.status).toBe(422)
    expect(e.requestId).toBe('req_9')
    expect(e.details).toEqual({ remaining_attempts: 3 })
    expect(e.retryAfterSeconds).toBeUndefined()
  })

  it('doit accepter le statut sous `status` ou `statusCode`', () => {
    expect(toAuthError(fetchError({ status: 503, data: {} })).status).toBe(503)
    expect(toAuthError(fetchError({ statusCode: 429, data: {} })).status).toBe(429)
  })

  it('doit produire UNKNOWN / statut 0 / details vides pour une panne réseau (aucune réponse)', () => {
    const e = toAuthError(new TypeError('Failed to fetch'))
    expect(e.code).toBe('UNKNOWN')
    expect(e.status).toBe(0)
    expect(e.details).toEqual({})
    expect(e.requestId).toBeUndefined()
    expect(authErrorKey(e)).toBe('cp.auth.genericError')
  })

  it('doit lire Retry-After d’un 429 et le rendre lisible (45 s, 1 min 30 s)', () => {
    const e = toAuthError(
      fetchError({
        statusCode: 429,
        data: { error: { code: 'PLATFORM_RATE_LIMIT' } },
        retryAfter: '90',
      }),
    )
    expect(e.retryAfterSeconds).toBe(90)
    expect(authErrorKey(e)).toBe('cp.auth.rateLimited')
    const t = (key: string, p?: Record<string, unknown>) => `${key}${JSON.stringify(p)}`
    expect(formatWait(e.retryAfterSeconds ?? 0, t)).toBe(
      'cp.auth.duration.minutesSeconds{"m":1,"s":30}',
    )
  })

  it.each([[null], ['abc'], ['0'], ['-5'], ['']])(
    'doit ignorer un Retry-After absent ou inexploitable (%j)',
    (header) => {
      const e = toAuthError(fetchError({ statusCode: 429, data: {}, retryAfter: header }))
      expect(e.retryAfterSeconds).toBeUndefined()
      expect(e.status).toBe(429)
    },
  )

  it('doit gérer un 503 SMS indisponible avec un corps du catalogue', () => {
    const e = toAuthError(
      fetchError({
        statusCode: 503,
        data: { error: { code: 'AUTH_SMS_UNAVAILABLE', details: {} } },
      }),
    )
    expect(e.status).toBe(503)
    expect(authErrorKey(e)).toBe('cp.auth.code.smsUnavailable')
  })

  it('doit tolérer un corps d’erreur qui n’est pas JSON (page HTML d’un proxy) sans lever', () => {
    const e = toAuthError(fetchError({ statusCode: 502, data: '<html>Bad gateway</html>' }))
    expect(e.code).toBe('UNKNOWN')
    expect(e.status).toBe(502)
    expect(authErrorKey(e)).toBe('cp.auth.genericError')
  })
})
