import { z } from 'zod'

/** Pepper de développement uniquement (jamais utilisé en production : `OTP_PEPPER` y est obligatoire). */
const DEV_OTP_PEPPER = 'dev-only-otp-pepper-never-use-in-production-0000'

const apiEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    APP_URL: z.string().url().default('http://localhost:3000'),

    SMTP_HOST: z.string().min(1).default('localhost'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    SMTP_USER: z.string().default(''),
    SMTP_PASSWORD: z.string().default(''),
    SMTP_FROM: z.string().default('noreply@project-cp.local'),

    SESSION_COOKIE_NAME: z.string().default('cp_session'),
    SESSION_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(86400),
    SESSION_REMEMBER_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(604800),

    TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(0),

    REDIS_URL: z.string().url().default('redis://localhost:6379'),

    OTEL_ENABLED: z
      .enum(['true', 'false', '1', '0'])
      .default('false')
      .transform((v) => v === 'true' || v === '1'),
    OTEL_SERVICE_NAME: z.string().min(1).default('cp-api'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),

    // Défaut selon NODE_ENV appliqué après validation croisée (simulated hors prod, none en prod).
    SMS_PROVIDER: z.enum(['simulated', 'none']).optional(),
    // [S] secret (Infisical). Défaut de dev appliqué hors production uniquement.
    OTP_PEPPER: z.string().min(32).optional(),
  })
  .superRefine((raw, ctx) => {
    if (raw.NODE_ENV !== 'production') return
    // Messages volontairement sans aucune valeur (le pepper est un secret).
    if (raw.SMS_PROVIDER === 'simulated') {
      ctx.addIssue({
        code: 'custom',
        path: ['SMS_PROVIDER'],
        message: 'SMS_PROVIDER=simulated is forbidden when NODE_ENV=production',
      })
    }
    if (raw.OTP_PEPPER === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['OTP_PEPPER'],
        message: 'OTP_PEPPER is required when NODE_ENV=production',
      })
    }
  })
  .transform((raw) => ({
    ...raw,
    SMS_PROVIDER: raw.SMS_PROVIDER ?? (raw.NODE_ENV === 'production' ? 'none' : 'simulated'),
    OTP_PEPPER: raw.OTP_PEPPER ?? DEV_OTP_PEPPER,
  }))

export type ApiEnv = z.infer<typeof apiEnvSchema>

let cached: ApiEnv | undefined

export function getEnv(): ApiEnv {
  if (cached) return cached
  cached = apiEnvSchema.parse(process.env)
  return cached
}

export function resetEnvCache(): void {
  cached = undefined
}
