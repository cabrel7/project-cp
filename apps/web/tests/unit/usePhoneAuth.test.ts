/**
 * P2.2 — logique de `usePhoneAuth` (état de la demande, horodatages, charge utile envoyée, erreurs) avec les
 * auto-imports Nuxt remplacés par des doubles. Seule frontière simulée : `$fetch` (API). `import.meta.client` n'existe
 * pas sous Vitest : le stockage navigateur est couvert par phoneAuth.test.ts / phoneAuth.edge.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthError } from '../../app/composables/useAuth'
import { usePhoneAuth } from '../../app/composables/usePhoneAuth'

// Mini-réactivité de test : `vue` n'est pas une dépendance directe de apps/web (résolution pnpm stricte).
type Ref<T> = { value: T }
const ref = <T>(value: T): Ref<T> => ({ value })
const computed = <T>(getter: () => T): { readonly value: T } => ({
  get value() {
    return getter()
  },
})

const states = new Map<string, Ref<unknown>>()
const fetchMock = vi.fn()
const navigateTo = vi.fn()
const locale = ref('fr')
const user = ref<unknown>(null)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-12T10:00:00Z'))
  states.clear()
  fetchMock.mockReset()
  navigateTo.mockReset()
  locale.value = 'fr'
  user.value = null
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: '' } }))
  vi.stubGlobal('useI18n', () => ({ locale }))
  vi.stubGlobal('useAuth', () => ({ user }))
  vi.stubGlobal('useState', (key: string, init: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(init()))
    return states.get(key)
  })
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('onMounted', () => {})
  vi.stubGlobal('onBeforeUnmount', () => {})
  vi.stubGlobal('navigateTo', navigateTo)
  vi.stubGlobal('$fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const input = { e164: '+237690123442', country: 'CM', intent: 'register' as const, fullName: 'Awa' }
const ok = { ok: true, expires_in_seconds: 300, resend_after_seconds: 60 }

describe('usePhoneAuth.requestCode', () => {
  it('doit mémoriser la demande avec des horodatages absolus (5 min, renvoi à 60 s) et envoyer la langue', async () => {
    fetchMock.mockResolvedValue(ok)
    const p = usePhoneAuth()
    const t0 = Date.now()
    const s = await p.requestCode(input)
    expect(s).toEqual({ ...input, expiresAt: t0 + 300_000, resendAt: t0 + 60_000 })
    expect(p.request.value).toEqual(s)
    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/auth/phone/request-code',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: { phone: '+237690123442', country: 'CM', locale: 'fr' },
      }),
    )
    expect(p.isLoading.value).toBe(false)
  })

  it('doit envoyer locale « en » seulement pour l’anglais (toute autre langue → fr) et omettre fullName absent', async () => {
    fetchMock.mockResolvedValue(ok)
    const p = usePhoneAuth()
    locale.value = 'en'
    await p.requestCode({ e164: input.e164, country: 'CM', intent: 'login' })
    expect(fetchMock.mock.calls[0]?.[1].body.locale).toBe('en')
    expect(p.request.value).not.toHaveProperty('fullName')
    locale.value = 'es'
    await p.requestCode({ e164: input.e164, country: 'CM', intent: 'login' })
    expect(fetchMock.mock.calls[1]?.[1].body.locale).toBe('fr')
  })

  it('doit suivre le compte à rebours de renvoi aux bornes (60 s → 0, renvoi possible à l’échéance)', async () => {
    fetchMock.mockResolvedValue(ok)
    const p = usePhoneAuth()
    await p.requestCode(input)
    expect(p.resendSeconds.value).toBe(60)
    expect(p.canResend.value).toBe(false)
  })

  it('doit rester sans demande et sans compte à rebours quand aucune demande n’est en cours', () => {
    const p = usePhoneAuth()
    expect(p.request.value).toBeNull()
    expect(p.resendSeconds.value).toBe(0)
    expect(p.canResend.value).toBe(true)
  })

  it.each([
    [
      '429 Retry-After',
      {
        statusCode: 429,
        data: { error: { code: 'PLATFORM_RATE_LIMIT' } },
        response: { headers: { get: () => '45' } },
      },
      429,
      'PLATFORM_RATE_LIMIT',
    ],
    [
      '503 SMS indisponible',
      { statusCode: 503, data: { error: { code: 'AUTH_SMS_UNAVAILABLE' } } },
      503,
      'AUTH_SMS_UNAVAILABLE',
    ],
    [
      '422 numéro',
      {
        statusCode: 422,
        data: {
          error: {
            code: 'PLATFORM_VALIDATION_ERROR',
            details: { field: 'phone', reason: 'TOO_SHORT', expected_length: 9 },
          },
        },
      },
      422,
      'PLATFORM_VALIDATION_ERROR',
    ],
    ['réseau', new TypeError('Failed to fetch'), 0, 'UNKNOWN'],
  ])(
    'erreur %s : lève une AuthError normalisée, ne mémorise rien et libère le chargement',
    async (_n, failure, status, code) => {
      fetchMock.mockRejectedValue(failure)
      const p = usePhoneAuth()
      const e = await p.requestCode(input).catch((x: unknown) => x)
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).status).toBe(status)
      expect((e as AuthError).code).toBe(code)
      expect(p.request.value).toBeNull()
      expect(p.isLoading.value).toBe(false)
    },
  )

  it('doit exposer Retry-After du 429 à l’interface', async () => {
    fetchMock.mockRejectedValue({
      statusCode: 429,
      data: {},
      response: { headers: { get: () => '45' } },
    })
    const e = (await usePhoneAuth()
      .requestCode(input)
      .catch((x: unknown) => x)) as AuthError
    expect(e.retryAfterSeconds).toBe(45)
  })

  it('un échec de renvoi ne doit pas effacer la demande en cours', async () => {
    fetchMock.mockResolvedValueOnce(ok)
    const p = usePhoneAuth()
    const first = await p.requestCode(input)
    fetchMock.mockRejectedValueOnce({ statusCode: 429, data: {} })
    await expect(p.resend()).rejects.toBeInstanceOf(AuthError)
    expect(p.request.value).toEqual(first)
  })
})

describe('usePhoneAuth.resend', () => {
  it('doit relancer la demande pour le même numéro et relancer le compte à rebours', async () => {
    fetchMock.mockResolvedValue(ok)
    const p = usePhoneAuth()
    await p.requestCode(input)
    vi.advanceTimersByTime(61_000)
    const again = await p.resend()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[1].body.phone).toBe(input.e164)
    expect(again.resendAt).toBe(Date.now() + 60_000)
    expect(p.resendSeconds.value).toBe(60)
  })

  it('doit lever une AuthError sans appel réseau quand aucune demande n’est en cours', async () => {
    const p = usePhoneAuth()
    await expect(p.resend()).rejects.toBeInstanceOf(AuthError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('usePhoneAuth.verifyCode', () => {
  const session = {
    user: { id: 'u1', phone: '+237690123442' },
    session: { id: 's1' },
    is_new_user: true,
  }

  it('doit envoyer le code, le nom (inscription) et remember_me, puis ouvrir la session, effacer la demande et aller à l’accueil', async () => {
    fetchMock.mockResolvedValueOnce(ok).mockResolvedValueOnce(session)
    const p = usePhoneAuth()
    await p.requestCode(input)
    await p.verifyCode('270512')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/v1/auth/phone/verify-code')
    expect(fetchMock.mock.calls[1]?.[1].body).toEqual({
      phone: input.e164,
      country: 'CM',
      code: '270512',
      full_name: 'Awa',
      remember_me: true,
      locale: 'fr',
    })
    expect(user.value).toEqual(session.user)
    expect(p.request.value).toBeNull()
    expect(navigateTo).toHaveBeenCalledWith('/')
  })

  it('ne doit jamais conserver le code dans la demande mémorisée', async () => {
    fetchMock
      .mockResolvedValueOnce(ok)
      .mockRejectedValueOnce({ statusCode: 422, data: { error: { code: 'AUTH_OTP_INVALID' } } })
    const p = usePhoneAuth()
    await p.requestCode(input)
    await p.verifyCode('270512').catch(() => {})
    expect(JSON.stringify(p.request.value)).not.toContain('270512')
  })

  it('connexion (sans nom) : n’envoie pas full_name', async () => {
    fetchMock.mockResolvedValueOnce(ok).mockResolvedValueOnce(session)
    const p = usePhoneAuth()
    await p.requestCode({ e164: input.e164, country: 'CM', intent: 'login' })
    await p.verifyCode('111111')
    expect(fetchMock.mock.calls[1]?.[1].body).not.toHaveProperty('full_name')
  })

  it.each([
    ['AUTH_OTP_INVALID', 422, { remaining_attempts: 3 }],
    ['AUTH_OTP_EXPIRED', 422, {}],
    ['AUTH_OTP_ATTEMPTS_EXCEEDED', 422, {}],
    ['AUTH_ACCOUNT_SUSPENDED', 403, {}],
    ['AUTH_SIGNUP_CLOSED', 403, {}],
  ])(
    '%s : lève l’erreur, garde la demande (pour « Recevoir un nouveau code »), n’ouvre pas de session',
    async (code, status, details) => {
      fetchMock
        .mockResolvedValueOnce(ok)
        .mockRejectedValueOnce({ statusCode: status, data: { error: { code, details } } })
      const p = usePhoneAuth()
      const before = await p.requestCode(input)
      const e = (await p.verifyCode('000000').catch((x: unknown) => x)) as AuthError
      expect(e).toBeInstanceOf(AuthError)
      expect(e.code).toBe(code)
      expect(e.details).toEqual(details)
      expect(p.request.value).toEqual(before)
      expect(user.value).toBeNull()
      expect(navigateTo).not.toHaveBeenCalled()
      expect(p.isLoading.value).toBe(false)
    },
  )

  it('doit lever une AuthError sans appel réseau quand aucune demande n’est en cours', async () => {
    await expect(usePhoneAuth().verifyCode('123456')).rejects.toBeInstanceOf(AuthError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('usePhoneAuth.cancel / restore', () => {
  it('cancel doit effacer la demande en mémoire', async () => {
    fetchMock.mockResolvedValue(ok)
    const p = usePhoneAuth()
    await p.requestCode(input)
    p.cancel()
    expect(p.request.value).toBeNull()
    expect(p.resendSeconds.value).toBe(0)
  })

  it('restore ne doit rien relire hors navigateur (rendu serveur : pas de sessionStorage)', () => {
    expect(usePhoneAuth().restore()).toBeNull()
  })
})
