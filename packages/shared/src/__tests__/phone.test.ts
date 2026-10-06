/**
 * P2.2 — normalisation E.164 (CA-1 à CA-4), masquage et schémas zod du téléphone.
 * Règle testée : spec P2.2 §2 (CA-1…CA-4) et §3.1 (contrats `@cp/shared`).
 *
 * Phase RED : `../phone.js` n'existe pas encore. Le module est chargé dynamiquement (chemin
 * calculé, donc non résolu à la transformation) pour que chaque test échoue individuellement
 * avec « module absent » au lieu d'un échec global de fichier (aucun test collecté).
 */
import { describe, expect, it } from 'vitest'
import * as authSchemas from '../auth-schemas.js'

type PhoneModule = typeof import('../phone.js')

const PHONE_MODULE_PATH = '../phone.js'
const loadPhone = async (): Promise<PhoneModule> =>
  (await import(/* @vite-ignore */ PHONE_MODULE_PATH)) as PhoneModule

/** Contrainte SQL `iam.users.phone_e164`. */
const E164_SQL = /^\+[1-9][0-9]{6,14}$/

describe('normalizePhone — numéros valides (CA-1)', () => {
  it.each([
    ['6 90 12 34 42', 'saisie nationale avec espaces'],
    ['+237 690-12-34-42', 'format international avec tirets'],
    ['00237690123442', 'préfixe international 00'],
    ['690123442', 'saisie nationale sans espaces'],
  ])('doit renvoyer +237690123442 pour « %s » (%s) avec le pays CM', async (input) => {
    const { normalizePhone } = await loadPhone()
    expect(normalizePhone(input, 'CM')).toEqual({ ok: true, e164: '+237690123442', country: 'CM' })
  })

  it.each([
    ['06 12 34 56 78', 'FR', '+33612345678'],
    ['77 123 45 67', 'SN', '+221771234567'],
    ['07 07 12 34 56', 'CI', '+2250707123456'],
    ['0470 12 34 56', 'BE', '+32470123456'],
  ] as const)('doit normaliser « %s » (%s) en %s', async (input, country, e164) => {
    const { normalizePhone } = await loadPhone()
    expect(normalizePhone(input, country)).toEqual({ ok: true, e164, country })
  })

  it('doit produire un E.164 conforme à la contrainte SQL users.phone_e164', async () => {
    const { normalizePhone } = await loadPhone()
    const result = normalizePhone('6 90 12 34 42', 'CM')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.e164).toMatch(E164_SQL)
  })

  it('doit accepter un fixe-ou-mobile (FIXED_LINE_OR_MOBILE) comme un mobile (CA-3)', async () => {
    const { normalizePhone } = await loadPhone()
    // +1 415 555 2671 : type FIXED_LINE_OR_MOBILE chez libphonenumber (plan nord-américain).
    expect(normalizePhone('(415) 555-2671', 'US')).toEqual({
      ok: true,
      e164: '+14155552671',
      country: 'US',
    })
  })
})

describe('normalizePhone — refus structurés (CA-2, CA-3, CA-4)', () => {
  it('doit refuser TOO_SHORT avec expectedLength=9 quand il manque des chiffres (CM)', async () => {
    const { normalizePhone } = await loadPhone()
    expect(normalizePhone('6 90 12 34', 'CM')).toEqual({
      ok: false,
      reason: 'TOO_SHORT',
      expectedLength: 9,
    })
  })

  it('doit refuser TOO_LONG quand il y a trop de chiffres', async () => {
    const { normalizePhone } = await loadPhone()
    const result = normalizePhone('6901234421234', 'CM')
    expect(result).toMatchObject({ ok: false, reason: 'TOO_LONG' })
  })

  it.each(['abc', 'téléphone'])(
    'doit refuser NOT_A_NUMBER pour du texte (« %s »)',
    async (text) => {
      const { normalizePhone } = await loadPhone()
      expect(normalizePhone(text, 'CM')).toMatchObject({ ok: false, reason: 'NOT_A_NUMBER' })
    },
  )

  it('doit refuser INVALID quand la longueur est plausible mais le numéro inexistant', async () => {
    const { normalizePhone } = await loadPhone()
    expect(normalizePhone('100000000', 'CM')).toMatchObject({ ok: false, reason: 'INVALID' })
  })

  it('doit refuser INVALID_COUNTRY pour un indicatif international inconnu', async () => {
    const { normalizePhone } = await loadPhone()
    expect(normalizePhone('+999 123 456 789', 'CM')).toMatchObject({
      ok: false,
      reason: 'INVALID_COUNTRY',
    })
  })

  it.each([
    ['222234000', 'CM', 'fixe camerounais'],
    ['01 23 45 67 89', 'FR', 'fixe français'],
  ] as const)(
    'doit refuser NOT_MOBILE pour « %s » (%s) : un SMS ne peut pas atteindre un fixe',
    async (input, country) => {
      const { normalizePhone } = await loadPhone()
      expect(normalizePhone(input, country)).toMatchObject({ ok: false, reason: 'NOT_MOBILE' })
    },
  )

  it('doit refuser COUNTRY_NOT_SUPPORTED pour un numéro valide d’un pays hors liste (GB)', async () => {
    const { normalizePhone } = await loadPhone()
    expect(normalizePhone('+44 7700 900123', 'CM')).toMatchObject({
      ok: false,
      reason: 'COUNTRY_NOT_SUPPORTED',
    })
  })

  it('ne doit jamais lever d’exception ni renvoyer d’e164 pour une entrée invalide', async () => {
    const { normalizePhone } = await loadPhone()
    for (const input of ['', '   ', '+', '++237', '0', 'a'.repeat(40), '<script>']) {
      const result = normalizePhone(input, 'CM')
      expect(result.ok).toBe(false)
      expect(result).not.toHaveProperty('e164')
    }
  })
})

describe('SUPPORTED_PHONE_COUNTRIES et phoneCountrySchema (CA-4)', () => {
  const EXPECTED = [
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
  ]

  it('doit contenir exactement les 15 pays de la spec', async () => {
    const { SUPPORTED_PHONE_COUNTRIES } = await loadPhone()
    expect([...SUPPORTED_PHONE_COUNTRIES].sort()).toEqual([...EXPECTED].sort())
  })

  it('doit accepter chaque pays supporté et refuser un pays hors liste dans phoneCountrySchema', async () => {
    const { phoneCountrySchema, SUPPORTED_PHONE_COUNTRIES } = await loadPhone()
    for (const code of SUPPORTED_PHONE_COUNTRIES) {
      expect(phoneCountrySchema.safeParse(code).success).toBe(true)
    }
    for (const code of ['GB', 'cm', '', 'CMR', null]) {
      expect(phoneCountrySchema.safeParse(code).success).toBe(false)
    }
  })
})

describe('maskPhone', () => {
  it('doit masquer le milieu du numéro au format de la maquette 06 (« +237 6 90 •• •• 42 »)', async () => {
    const { maskPhone } = await loadPhone()
    expect(maskPhone('+237690123442')).toBe('+237 6 90 •• •• 42')
  })

  it('doit garder l’indicatif et les 2 derniers chiffres, et cacher les chiffres du milieu (FR)', async () => {
    const { maskPhone } = await loadPhone()
    const masked = maskPhone('+33612345678')
    expect(masked.startsWith('+33')).toBe(true)
    expect(masked.endsWith('78')).toBe(true)
    expect(masked).toContain('•')
    expect(masked).not.toContain('12345')
    expect(masked).not.toContain('+33612345678')
  })

  it('ne doit jamais renvoyer le numéro complet ni ses chiffres centraux', async () => {
    const { maskPhone } = await loadPhone()
    for (const e164 of ['+237690123442', '+221771234567', '+2250707123456', '+14155552671']) {
      const masked = maskPhone(e164)
      expect(masked).not.toContain(e164)
      expect(masked.replaceAll(/\D/g, '')).not.toContain(e164.slice(6, 11))
    }
  })
})

describe('schémas zod du téléphone (spec §3.1)', () => {
  it('phoneRequestCodeBodySchema doit appliquer les défauts country=CM et locale=fr', () => {
    const parsed = authSchemas.phoneRequestCodeBodySchema.parse({ phone: '6 90 12 34 42' })
    expect(parsed).toEqual({ phone: '6 90 12 34 42', country: 'CM', locale: 'fr' })
  })

  it('phoneRequestCodeBodySchema doit rogner le numéro et refuser < 4 ou > 32 caractères', () => {
    expect(authSchemas.phoneRequestCodeBodySchema.parse({ phone: '  690123442  ' }).phone).toBe(
      '690123442',
    )
    expect(authSchemas.phoneRequestCodeBodySchema.safeParse({ phone: '123' }).success).toBe(false)
    expect(
      authSchemas.phoneRequestCodeBodySchema.safeParse({ phone: '1'.repeat(33) }).success,
    ).toBe(false)
    expect(authSchemas.phoneRequestCodeBodySchema.safeParse({}).success).toBe(false)
  })

  it('phoneRequestCodeBodySchema doit refuser un pays hors liste et une langue inconnue', () => {
    expect(
      authSchemas.phoneRequestCodeBodySchema.safeParse({ phone: '690123442', country: 'GB' })
        .success,
    ).toBe(false)
    expect(
      authSchemas.phoneRequestCodeBodySchema.safeParse({ phone: '690123442', locale: 'de' })
        .success,
    ).toBe(false)
  })

  it('phoneVerifyCodeBodySchema doit appliquer remember_me=true par défaut (D61)', () => {
    const parsed = authSchemas.phoneVerifyCodeBodySchema.parse({
      phone: '690123442',
      code: '270512',
    })
    expect(parsed).toEqual({
      phone: '690123442',
      country: 'CM',
      code: '270512',
      remember_me: true,
      locale: 'fr',
    })
  })

  it.each(['12345', '1234567', 'abcdef', '12 345', '', '１２３４５６'])(
    'phoneVerifyCodeBodySchema doit refuser le code « %s » (6 chiffres ASCII exactement)',
    (code) => {
      expect(
        authSchemas.phoneVerifyCodeBodySchema.safeParse({ phone: '690123442', code }).success,
      ).toBe(false)
    },
  )

  it('phoneVerifyCodeBodySchema doit accepter un code à zéros initiaux et full_name optionnel rogné', () => {
    const parsed = authSchemas.phoneVerifyCodeBodySchema.parse({
      phone: '690123442',
      code: '000042',
      full_name: '  Awa Nkeng  ',
      remember_me: false,
    })
    expect(parsed.code).toBe('000042')
    expect(parsed.full_name).toBe('Awa Nkeng')
    expect(parsed.remember_me).toBe(false)
  })

  it('phoneVerifyCodeBodySchema doit refuser un full_name vide ou de plus de 200 caractères', () => {
    const base = { phone: '690123442', code: '270512' }
    expect(
      authSchemas.phoneVerifyCodeBodySchema.safeParse({ ...base, full_name: '' }).success,
    ).toBe(false)
    expect(
      authSchemas.phoneVerifyCodeBodySchema.safeParse({ ...base, full_name: 'a'.repeat(201) })
        .success,
    ).toBe(false)
  })

  it('phoneRequestCodeResponseSchema doit exiger ok:true et deux entiers', () => {
    const ok = { ok: true, expires_in_seconds: 300, resend_after_seconds: 60 }
    expect(authSchemas.phoneRequestCodeResponseSchema.safeParse(ok).success).toBe(true)
    expect(authSchemas.phoneRequestCodeResponseSchema.safeParse({ ...ok, ok: false }).success).toBe(
      false,
    )
    expect(
      authSchemas.phoneRequestCodeResponseSchema.safeParse({ ...ok, expires_in_seconds: 1.5 })
        .success,
    ).toBe(false)
  })

  it('meResponseSchema doit exposer phone, phone_verified et free_tier_eligible (additif)', () => {
    const base = {
      id: '0190a000-0000-7000-8000-000000000001',
      email: null,
      email_verified: false,
      full_name: 'Awa Nkeng',
      locale: 'fr',
      timezone: 'Africa/Douala',
      created_at: '2026-10-06T10:00:00.000Z',
    }
    const parsed = authSchemas.meResponseSchema.parse({
      ...base,
      phone: '+237690123442',
      phone_verified: true,
      free_tier_eligible: true,
    })
    expect(parsed).toMatchObject({
      phone: '+237690123442',
      phone_verified: true,
      free_tier_eligible: true,
    })
    expect(
      authSchemas.meResponseSchema.parse({
        ...base,
        phone: null,
        phone_verified: false,
        free_tier_eligible: false,
      }).phone,
    ).toBeNull()
  })

  it('phoneVerifyCodeResponseSchema doit étendre authResponseSchema avec is_new_user', () => {
    const user = {
      id: '0190a000-0000-7000-8000-000000000001',
      email: null,
      email_verified: false,
      full_name: 'Awa Nkeng',
      locale: 'fr',
      timezone: 'Africa/Douala',
      created_at: '2026-10-06T10:00:00.000Z',
      phone: '+237690123442',
      phone_verified: true,
      free_tier_eligible: true,
    }
    const session = {
      id: '0190a000-0000-7000-8000-0000000000aa',
      ip: '203.0.113.5',
      user_agent: 'vitest',
      device_label: null,
      created_at: '2026-10-06T10:00:00.000Z',
      last_seen_at: '2026-10-06T10:00:00.000Z',
      is_current: true,
    }
    expect(
      authSchemas.phoneVerifyCodeResponseSchema.safeParse({ user, session, is_new_user: true })
        .success,
    ).toBe(true)
    expect(authSchemas.phoneVerifyCodeResponseSchema.safeParse({ user, session }).success).toBe(
      false,
    )
  })
})
