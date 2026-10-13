import { z } from 'zod'

/** Pepper de développement uniquement (jamais utilisé en production : `OTP_PEPPER` y est obligatoire). */
const DEV_OTP_PEPPER = 'dev-only-otp-pepper-never-use-in-production-0000'

/**
 * Valeurs de `OTP_PEPPER` publiées dans le dépôt (`.env.example`, repli de dev, CI) : ce ne sont plus des secrets.
 * Valides hors production uniquement ; jamais citées dans un message d'erreur.
 */
const PUBLIC_OTP_PEPPERS: ReadonlySet<string> = new Set([
  DEV_OTP_PEPPER,
  'ci-only-otp-pepper-0123456789abcdef-not-a-secret',
])

/** Chaîne vide = variable absente (un `.env` qui déclare `GOOGLE_CLIENT_ID=` désactive Google, sans erreur). */
const emptyAsUndefined = (value: unknown): unknown => (value === '' ? undefined : value)

const GOOGLE_CLIENT_ID_SUFFIX = '.apps.googleusercontent.com'

const apiEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    // Origine du site web : liens des e-mails et origine autorisée par le contrôle CSRF. Obligatoire en production.
    APP_URL: z.string().url().optional(),

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

    // Nombre de proxys de confiance devant l'API (Nginx = 1, exposition directe = 0). Entier >= 0. Obligatoire en
    // production ; vide = absent (pas de repli silencieux sur 0 par coercition de '').
    TRUSTED_PROXY_HOPS: z
      .union([
        z.literal('').transform(() => undefined),
        z
          .string()
          .regex(/^\d{1,3}$/)
          .transform(Number),
      ])
      .optional(),

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

    // Connexion Google (P2.3). Les deux ou aucune ; vide = absente. Les messages citent le NOM, jamais la valeur.
    GOOGLE_CLIENT_ID: z.preprocess(
      emptyAsUndefined,
      z
        .string()
        .endsWith(GOOGLE_CLIENT_ID_SUFFIX, `must end with ${GOOGLE_CLIENT_ID_SUFFIX}`)
        .optional(),
    ),
    // [S] secret (Infisical).
    GOOGLE_CLIENT_SECRET: z.preprocess(emptyAsUndefined, z.string().min(16).optional()),
  })
  .superRefine((raw, ctx) => {
    if ((raw.GOOGLE_CLIENT_ID === undefined) !== (raw.GOOGLE_CLIENT_SECRET === undefined)) {
      const missing =
        raw.GOOGLE_CLIENT_ID === undefined ? 'GOOGLE_CLIENT_ID' : 'GOOGLE_CLIENT_SECRET'
      ctx.addIssue({
        code: 'custom',
        path: [missing],
        message:
          'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together (or both left empty)',
      })
    }
    if (raw.NODE_ENV !== 'production') return
    if (raw.APP_URL === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_URL'],
        message: 'APP_URL is required when NODE_ENV=production',
      })
    }
    if (raw.TRUSTED_PROXY_HOPS === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['TRUSTED_PROXY_HOPS'],
        message: 'TRUSTED_PROXY_HOPS is required when NODE_ENV=production (integer >= 0)',
      })
    }
    // Messages volontairement sans aucune valeur (le pepper est un secret).
    if (raw.SMS_PROVIDER === 'simulated') {
      ctx.addIssue({
        code: 'custom',
        path: ['SMS_PROVIDER'],
        message: 'SMS_PROVIDER=simulated is forbidden when NODE_ENV=production',
      })
    }
    if (raw.OTP_PEPPER !== undefined && PUBLIC_OTP_PEPPERS.has(raw.OTP_PEPPER)) {
      ctx.addIssue({
        code: 'custom',
        path: ['OTP_PEPPER'],
        message: 'OTP_PEPPER must not be a publicly known value when NODE_ENV=production',
      })
    }
    if (raw.OTP_PEPPER === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['OTP_PEPPER'],
        message: 'OTP_PEPPER is required when NODE_ENV=production',
      })
    }
    // La redirect_uri de Google dérive d'APP_URL : en production, elle doit être en https.
    if (
      raw.GOOGLE_CLIENT_ID !== undefined &&
      raw.GOOGLE_CLIENT_SECRET !== undefined &&
      raw.APP_URL !== undefined &&
      !raw.APP_URL.toLowerCase().startsWith('https://')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_URL'],
        message: 'APP_URL must use https when Google sign-in is configured and NODE_ENV=production',
      })
    }
  })
  .transform((raw) => ({
    ...raw,
    APP_URL: raw.APP_URL ?? 'http://localhost:3000',
    TRUSTED_PROXY_HOPS: raw.TRUSTED_PROXY_HOPS ?? 0,
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
