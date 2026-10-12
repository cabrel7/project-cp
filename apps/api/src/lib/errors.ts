import { ERROR_CODES, type ErrorCode, type ErrorCodeDef } from '@cp/shared/errors'

export interface AppErrorOptions extends ErrorOptions {
  /** Délai conseillé avant nouvel essai : devient l'en-tête `Retry-After` (429, 503). */
  retryAfterSeconds?: number
}

export class AppError extends Error {
  public readonly errorDef: ErrorCodeDef
  public readonly retryAfterSeconds: number | undefined

  constructor(
    public readonly code: ErrorCode,
    public readonly details?: Record<string, unknown>,
    options?: AppErrorOptions,
  ) {
    super(code, options?.cause === undefined ? undefined : { cause: options.cause })
    this.retryAfterSeconds = options?.retryAfterSeconds
    this.name = 'AppError'
    this.errorDef = ERROR_CODES[code]
  }

  get httpStatus(): number {
    return this.errorDef.httpStatus
  }
}
