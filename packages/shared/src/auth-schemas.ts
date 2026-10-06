import { z } from 'zod'
import { phoneCountrySchema } from './phone.js'
import { publicIdSchema } from './schemas.js'

const emailField = z
  .string()
  .email()
  .transform((e) => e.toLowerCase().trim())

export const registerBodySchema = z.object({
  email: emailField,
  password: z.string().min(8).max(128),
  full_name: z.string().min(1).max(200).optional(),
})

export type RegisterBody = z.infer<typeof registerBodySchema>

export const loginBodySchema = z.object({
  email: emailField,
  password: z.string().min(1),
  remember_me: z.boolean().default(false),
})

export type LoginBody = z.infer<typeof loginBodySchema>

export const forgotPasswordBodySchema = z.object({
  email: emailField,
})

export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
})

export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>

export const verifyEmailBodySchema = z.object({
  token: z.string().min(1),
})

export type VerifyEmailBody = z.infer<typeof verifyEmailBodySchema>

export const sessionResponseSchema = z.object({
  id: publicIdSchema,
  ip: z.string().nullable(),
  user_agent: z.string().nullable(),
  device_label: z.string().nullable(),
  created_at: z.string(),
  last_seen_at: z.string(),
  is_current: z.boolean(),
})

export type SessionResponse = z.infer<typeof sessionResponseSchema>

export const meResponseSchema = z.object({
  id: publicIdSchema,
  email: z.string().nullable(),
  email_verified: z.boolean(),
  full_name: z.string().nullable(),
  locale: z.string(),
  timezone: z.string(),
  created_at: z.string(),
  phone: z.string().nullable(),
  phone_verified: z.boolean(),
  free_tier_eligible: z.boolean(),
})

export type MeResponse = z.infer<typeof meResponseSchema>

export const authResponseSchema = z.object({
  user: meResponseSchema,
  session: sessionResponseSchema,
})

export type AuthResponse = z.infer<typeof authResponseSchema>

/** Numéro libre : la normalisation E.164 se fait dans le service (raison structurée en cas de refus). */
const phoneInputField = z.string().trim().min(4).max(32)

export const phoneRequestCodeBodySchema = z.object({
  phone: phoneInputField,
  country: phoneCountrySchema.default('CM'),
  locale: z.enum(['fr', 'en']).default('fr'),
})

export type PhoneRequestCodeBody = z.infer<typeof phoneRequestCodeBodySchema>

export const phoneRequestCodeResponseSchema = z.object({
  ok: z.literal(true),
  expires_in_seconds: z.number().int(),
  resend_after_seconds: z.number().int(),
})

export type PhoneRequestCodeResponse = z.infer<typeof phoneRequestCodeResponseSchema>

export const phoneVerifyCodeBodySchema = z.object({
  phone: phoneInputField,
  country: phoneCountrySchema.default('CM'),
  code: z.string().regex(/^[0-9]{6}$/),
  /** Utilisé seulement si le compte est créé. */
  full_name: z.string().trim().min(1).max(200).optional(),
  remember_me: z.boolean().default(true),
  locale: z.enum(['fr', 'en']).default('fr'),
})

export type PhoneVerifyCodeBody = z.infer<typeof phoneVerifyCodeBodySchema>

export const phoneVerifyCodeResponseSchema = authResponseSchema.extend({
  is_new_user: z.boolean(),
})

export type PhoneVerifyCodeResponse = z.infer<typeof phoneVerifyCodeResponseSchema>
