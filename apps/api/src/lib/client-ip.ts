import { isIP } from 'node:net'

export function getClientIp(c: {
  req: { header: (name: string) => string | undefined }
}): string | null {
  const candidate = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  return candidate && isIP(candidate) ? candidate : null
}
