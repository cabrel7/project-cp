import { z } from 'zod'

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

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
