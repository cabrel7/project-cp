import type { ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from '../context.js'
import { AppError } from '../lib/errors.js'

const DOC_BASE_URL = 'https://docs.project-cp.com'

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
      details: details ?? {},
      documentation_url: `${DOC_BASE_URL}/errors/${code.toLowerCase()}`,
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
    const details = err.httpStatus >= 500 ? undefined : err.details
    if (err.retryAfterSeconds !== undefined) {
      c.header('Retry-After', String(Math.max(1, Math.ceil(err.retryAfterSeconds))))
    }
    return c.json(errorBody(err.code, err.message, requestId, details), err.httpStatus as 400)
  }

  if (err instanceof HTTPException && err.status >= 400 && err.status < 500) {
    const status = err.status
    logger?.warn({ status, requestId }, 'HTTP exception')

    if (status === 401) {
      return c.json(
        errorBody('AUTH_TOKEN_INVALID', 'Invalid authentication token.', requestId),
        401,
      )
    }
    if (status === 404) {
      return c.json(
        errorBody(
          'PLATFORM_RESOURCE_NOT_FOUND',
          'The requested resource was not found.',
          requestId,
        ),
        404,
      )
    }
    if (status === 429) {
      return c.json(errorBody('PLATFORM_RATE_LIMIT', 'Rate limit exceeded.', requestId), 429)
    }

    return c.json(
      errorBody('PLATFORM_VALIDATION_ERROR', 'The request is invalid.', requestId),
      status === 400 ? 400 : 422,
    )
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
