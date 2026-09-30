import { ERROR_CODES, type ErrorCode, type ErrorCodeDef } from '@cp/shared/errors'

export class AppError extends Error {
  public readonly errorDef: ErrorCodeDef

  constructor(
    public readonly code: ErrorCode,
    public readonly details?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(code, options)
    this.name = 'AppError'
    this.errorDef = ERROR_CODES[code]
  }

  get httpStatus(): number {
    return this.errorDef.httpStatus
  }
}
