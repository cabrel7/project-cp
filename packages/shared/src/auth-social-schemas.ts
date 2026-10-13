import { z } from 'zod'

/** Fournisseurs de connexion sociale. Google seul en P2.3 (D67) ; `apple` s'ajoutera de façon additive en P8.8. */
export const socialProviderSchema = z.enum(['google'])

export type SocialProvider = z.infer<typeof socialProviderSchema>

/** `GET /v1/auth/methods` : méthodes de connexion proposées. `passkey` et `apple` valent `false` en P2.3 (P-3). */
export const authMethodsResponseSchema = z.object({
  password: z.literal(true),
  phone: z.boolean(),
  google: z.boolean(),
  passkey: z.boolean(),
  apple: z.boolean(),
})

export type AuthMethodsResponse = z.infer<typeof authMethodsResponseSchema>

/**
 * `GET /oauth/google/start` : navigation du navigateur, donc tout est facultatif et tolérant (jamais de 422 JSON).
 * `next` est filtré par `safeNextPath` dans le service.
 */
export const oauthStartQuerySchema = z.object({
  next: z.string().optional(),
  remember_me: z.enum(['true', 'false']).optional(),
  locale: z.string().optional(),
})

export type OauthStartQuery = z.infer<typeof oauthStartQuerySchema>

/** `GET /oauth/google/callback` : validé dans le service (longueurs), paramètres supplémentaires tolérés. */
export const oauthCallbackQuerySchema = z
  .object({
    code: z.string().optional(),
    state: z.string().optional(),
    error: z.string().optional(),
  })
  .passthrough()

export type OauthCallbackQuery = z.infer<typeof oauthCallbackQuerySchema>

export const oauthLinkBodySchema = z.object({ next: z.string().max(512).optional() })

export type OauthLinkBody = z.infer<typeof oauthLinkBodySchema>

export const oauthLinkResponseSchema = z.object({ authorization_url: z.url() })

export type OauthLinkResponse = z.infer<typeof oauthLinkResponseSchema>

export const linkPendingResponseSchema = z.object({
  provider: socialProviderSchema,
  /** E-mail du compte Google masqué (« a***@gmail.com »). */
  email_masked: z.string(),
})

export type LinkPendingResponse = z.infer<typeof linkPendingResponseSchema>

export const identityParamsSchema = z.object({ provider: socialProviderSchema })

/** Identité liée exposée à son propriétaire : ni `sub`, ni identifiant d'identité (la table n'a pas de `public_id`). */
export const userIdentitySchema = z.object({
  provider: socialProviderSchema,
  email: z.string().nullable(),
  /** ISO 8601 UTC. */
  linked_at: z.string(),
})

export type UserIdentity = z.infer<typeof userIdentitySchema>
