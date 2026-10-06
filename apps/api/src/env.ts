import { z } from 'zod'

const apiEnvSchema = z.object({
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

  OTEL_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  OTEL_SERVICE_NAME: z.string().min(1).default('cp-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
})

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
