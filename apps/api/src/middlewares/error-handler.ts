import type { ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from '../context.js'
import { AppError } from '../lib/errors.js'

const DOC_BASE_URL = 'https://docs.project-cp.com/errors'

function errorBody(
  code: string,
  message: string,
  requestId: string,
  details?: Record<string, unknown>,
) {
  return {
    error: {
      code,
      message,
      request_id: requestId,
      ...(details && Object.keys(details).length > 0 ? { details } : {}),
      documentation_url: `${DOC_BASE_URL}/${code}`,
    },
  }
}

export const onError: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId') ?? 'unknown'
  const logger = c.get('logger')

  if (err instanceof AppError) {
    if (err.httpStatus >= 500) {
      logger?.error({ err, requestId }, err.code)
    } else {
      logger?.warn({ code: err.code, details: err.details, requestId }, err.code)
    }
    // Never expose details on 5xx: they may carry internal context.
    const details = err.httpStatus >= 500 ? undefined : err.details
    return c.json(errorBody(err.code, err.code, requestId, details), err.httpStatus as 400)
  }

  // Hono framework errors (malformed JSON body, etc.): 4xx client error, not 500.
  if (err instanceof HTTPException && err.status >= 400 && err.status < 500) {
    logger?.warn({ status: err.status, requestId }, 'PLATFORM_VALIDATION_ERROR')
    return c.json(errorBody('PLATFORM_VALIDATION_ERROR', 'The request is invalid.', requestId), 422)
  }

  logger?.error({ err, requestId }, 'PLATFORM_INTERNAL_ERROR')
  return c.json(errorBody('PLATFORM_INTERNAL_ERROR', 'An internal error occurred.', requestId), 500)
}

export const notFound: NotFoundHandler<AppEnv> = (c) => {
  const requestId = c.get('requestId') ?? 'unknown'
  return c.json(
    errorBody('PLATFORM_RESOURCE_NOT_FOUND', 'The requested resource was not found.', requestId),
    404,
  )
}
