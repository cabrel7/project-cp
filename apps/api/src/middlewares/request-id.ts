import { createMiddleware } from 'hono/factory'
import { uuidv7 } from 'uuidv7'
import type { AppEnv } from '../context.js'

const UUIDV7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const requestId = createMiddleware<AppEnv>(async (c, next) => {
  const incoming = c.req.header('x-request-id')
  const id = incoming && UUIDV7_RE.test(incoming) ? incoming : uuidv7()
  c.set('requestId', id)
  c.header('X-Request-Id', id)
  await next()
})
