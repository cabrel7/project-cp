/**
 * P2.3 — contrats zod de la connexion Google (`auth-social-schemas.ts`) et ajouts additifs à `/me`.
 * Règles testées : spec P2.3 §3.1 (contrats), C1 (pas d'id d'identité exposé), D67 (Google seul), CA-23 (`/me` additif).
 *
 * Phase RED : `../auth-social-schemas.js` n'existe pas encore (import dynamique, un échec par test).
 */
import { describe, expect, it } from 'vitest'
import {
  authResponseSchema,
  meResponseSchema,
  phoneVerifyCodeResponseSchema,
} from '../auth-schemas.js'

type Social = typeof import('../auth-social-schemas.js')
const MODULE_PATH = '../auth-social-schemas.js'
const load = async (): Promise<Social> => (await import(/* @vite-ignore */ MODULE_PATH)) as Social

const PUBLIC_ID = '0192f1b2-7c3d-7e4f-8a5b-6c7d8e9f0a1b'

const baseMe = {
  id: PUBLIC_ID,
  email: 'awa@gmail.com',
  email_verified: true,
  full_name: 'Awa Nkeng',
  locale: 'fr',
  timezone: 'Africa/Douala',
  created_at: '2026-10-13T10:00:00Z',
  phone: null,
  phone_verified: false,
  free_tier_eligible: true,
}
const session = {
  id: PUBLIC_ID,
  ip: null,
  user_agent: null,
  device_label: null,
  created_at: '2026-10-13T10:00:00Z',
  last_seen_at: '2026-10-13T10:00:00Z',
  is_current: true,
}

describe('socialProviderSchema', () => {
  it('doit accepter google', async () => {
    const { socialProviderSchema } = await load()
    expect(socialProviderSchema.safeParse('google').success).toBe(true)
  })

  it.each([['apple'], ['github'], ['microsoft'], [''], [null], ['GOOGLE']])(
    'doit refuser %j (D35/D67 : Google seul en P2.3, apple arrive en P8.8)',
    async (value) => {
      const { socialProviderSchema } = await load()
      expect(socialProviderSchema.safeParse(value).success).toBe(false)
    },
  )
})

describe('authMethodsResponseSchema', () => {
  const full = { password: true, phone: true, google: true, passkey: false, apple: false }

  it('doit accepter le corps de GET /methods', async () => {
    const { authMethodsResponseSchema } = await load()
    expect(authMethodsResponseSchema.parse(full)).toEqual(full)
  })

  it('doit exiger password = true (le mot de passe est toujours disponible)', async () => {
    const { authMethodsResponseSchema } = await load()
    expect(authMethodsResponseSchema.safeParse({ ...full, password: false }).success).toBe(false)
  })

  it.each(['phone', 'google', 'passkey', 'apple'])(
    'doit exiger le champ booléen %s',
    async (field) => {
      const { authMethodsResponseSchema } = await load()
      const { [field as keyof typeof full]: _omitted, ...rest } = full
      expect(authMethodsResponseSchema.safeParse(rest).success).toBe(false)
      expect(authMethodsResponseSchema.safeParse({ ...full, [field]: 'true' }).success).toBe(false)
    },
  )

  it('doit laisser passkey et apple valoir true dans le contrat (le front se pilote par ce champ, P8.8 les active)', async () => {
    const { authMethodsResponseSchema } = await load()
    expect(
      authMethodsResponseSchema.safeParse({ ...full, passkey: true, apple: true }).success,
    ).toBe(true)
  })
})

describe('oauthStartQuerySchema (navigation : tout est facultatif)', () => {
  it('doit accepter une requête vide', async () => {
    const { oauthStartQuerySchema } = await load()
    expect(oauthStartQuerySchema.safeParse({}).success).toBe(true)
  })

  it('doit accepter next, remember_me et locale', async () => {
    const { oauthStartQuerySchema } = await load()
    const parsed = oauthStartQuerySchema.safeParse({
      next: '/account/security',
      remember_me: 'false',
      locale: 'en',
    })
    expect(parsed.success).toBe(true)
  })

  it('doit accepter remember_me = true', async () => {
    const { oauthStartQuerySchema } = await load()
    expect(oauthStartQuerySchema.safeParse({ remember_me: 'true' }).success).toBe(true)
  })
})

describe('oauthCallbackQuerySchema', () => {
  it('doit accepter une requête vide (le service répond FLOW_INVALID, jamais un 422 JSON)', async () => {
    const { oauthCallbackQuerySchema } = await load()
    expect(oauthCallbackQuerySchema.safeParse({}).success).toBe(true)
  })

  it('doit accepter code, state, error et tolérer des paramètres supplémentaires (scope, authuser, prompt…)', async () => {
    const { oauthCallbackQuerySchema } = await load()
    const parsed = oauthCallbackQuerySchema.safeParse({
      code: 'abc',
      state: 'def',
      error: 'access_denied',
      scope: 'openid email',
      authuser: '0',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toMatchObject({ scope: 'openid email', authuser: '0' })
  })
})

describe('oauthLinkBodySchema et oauthLinkResponseSchema', () => {
  it('doit accepter un corps vide et un next de 512 caractères au plus', async () => {
    const { oauthLinkBodySchema } = await load()
    expect(oauthLinkBodySchema.safeParse({}).success).toBe(true)
    expect(oauthLinkBodySchema.safeParse({ next: '/account/security' }).success).toBe(true)
    expect(oauthLinkBodySchema.safeParse({ next: `/${'a'.repeat(511)}` }).success).toBe(true)
  })

  it('doit refuser un next de plus de 512 caractères', async () => {
    const { oauthLinkBodySchema } = await load()
    expect(oauthLinkBodySchema.safeParse({ next: `/${'a'.repeat(512)}` }).success).toBe(false)
  })

  it('doit exiger une URL d’autorisation valide en réponse', async () => {
    const { oauthLinkResponseSchema } = await load()
    expect(
      oauthLinkResponseSchema.safeParse({
        authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1',
      }).success,
    ).toBe(true)
    expect(oauthLinkResponseSchema.safeParse({ authorization_url: 'pas une url' }).success).toBe(
      false,
    )
    expect(oauthLinkResponseSchema.safeParse({}).success).toBe(false)
  })
})

describe('linkPendingResponseSchema', () => {
  it('doit exposer le fournisseur et l’e-mail masqué seulement', async () => {
    const { linkPendingResponseSchema } = await load()
    expect(Object.keys(linkPendingResponseSchema.shape).sort()).toEqual([
      'email_masked',
      'provider',
    ])
    expect(
      linkPendingResponseSchema.safeParse({ provider: 'google', email_masked: 'a***@gmail.com' })
        .success,
    ).toBe(true)
    expect(
      linkPendingResponseSchema.safeParse({ provider: 'apple', email_masked: 'a***@gmail.com' })
        .success,
    ).toBe(false)
  })
})

describe('identityParamsSchema (DELETE /identities/{provider}, CA-17)', () => {
  it('doit accepter google', async () => {
    const { identityParamsSchema } = await load()
    expect(identityParamsSchema.safeParse({ provider: 'google' }).success).toBe(true)
  })

  it.each([['apple'], ['github'], ['1'], ['']])(
    'doit refuser le fournisseur %j (422)',
    async (provider) => {
      const { identityParamsSchema } = await load()
      expect(identityParamsSchema.safeParse({ provider }).success).toBe(false)
    },
  )
})

describe('userIdentitySchema (C1 : aucun identifiant d’identité, aucun sub)', () => {
  it('doit avoir exactement provider, email et linked_at', async () => {
    const { userIdentitySchema } = await load()
    expect(Object.keys(userIdentitySchema.shape).sort()).toEqual(['email', 'linked_at', 'provider'])
  })

  it('doit accepter un e-mail nul et refuser un fournisseur inconnu', async () => {
    const { userIdentitySchema } = await load()
    const base = { provider: 'google', email: null, linked_at: '2026-10-13T10:00:00Z' }
    expect(userIdentitySchema.safeParse(base).success).toBe(true)
    expect(userIdentitySchema.safeParse({ ...base, provider: 'apple' }).success).toBe(false)
  })

  it('ne doit pas laisser fuiter un sub ou un id interne passés en entrée', async () => {
    const { userIdentitySchema } = await load()
    const parsed = userIdentitySchema.parse({
      provider: 'google',
      email: 'awa@gmail.com',
      linked_at: '2026-10-13T10:00:00Z',
      sub: '1234567890',
      id: 5,
    })
    expect(Object.keys(parsed).sort()).toEqual(['email', 'linked_at', 'provider'])
  })
})

describe('meResponseSchema — ajouts additifs (CA-23)', () => {
  const identity = { provider: 'google', email: 'awa@gmail.com', linked_at: '2026-10-13T10:00:00Z' }

  it('doit déclarer has_password et identities', () => {
    expect(Object.keys(meResponseSchema.shape)).toEqual(
      expect.arrayContaining(['has_password', 'identities']),
    )
  })

  it('doit accepter un utilisateur avec has_password et identities', () => {
    expect(
      meResponseSchema.safeParse({ ...baseMe, has_password: false, identities: [identity] })
        .success,
    ).toBe(true)
    expect(
      meResponseSchema.safeParse({ ...baseMe, has_password: true, identities: [] }).success,
    ).toBe(true)
  })

  it('doit refuser une identité qui n’est pas google', () => {
    expect(
      meResponseSchema.safeParse({
        ...baseMe,
        has_password: true,
        identities: [{ ...identity, provider: 'apple' }],
      }).success,
    ).toBe(false)
  })

  it('doit propager les champs à authResponse.user et phoneVerifyCodeResponse.user', () => {
    const user = { ...baseMe, has_password: true, identities: [] }
    expect(authResponseSchema.safeParse({ user, session }).success).toBe(true)
    expect(
      phoneVerifyCodeResponseSchema.safeParse({ user, session, is_new_user: false }).success,
    ).toBe(true)
    expect(authResponseSchema.shape.user.shape).toHaveProperty('has_password')
    expect(authResponseSchema.shape.user.shape).toHaveProperty('identities')
  })
})
