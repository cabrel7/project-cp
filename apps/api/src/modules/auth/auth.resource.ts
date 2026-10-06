import type { MeResponse, SessionResponse } from '@cp/shared/auth-schemas'

export function toMeResponse(user: {
  publicId: string
  email: string | null
  emailVerifiedAt: string | null
  fullName: string | null
  locale: string
  timezone: string
  createdAt: string
}): MeResponse {
  return {
    id: user.publicId,
    email: user.email,
    email_verified: user.emailVerifiedAt !== null,
    full_name: user.fullName,
    locale: user.locale,
    timezone: user.timezone,
    created_at: user.createdAt,
  }
}

export function toSessionResponse(
  session: {
    publicId: string
    ip: string | null
    userAgent: string | null
    deviceLabel: string | null
    createdAt: string
    lastSeenAt: string
  },
  currentSessionId?: bigint,
  sessionId?: bigint,
): SessionResponse {
  return {
    id: session.publicId,
    ip: session.ip,
    user_agent: session.userAgent,
    device_label: session.deviceLabel,
    created_at: session.createdAt,
    last_seen_at: session.lastSeenAt,
    is_current:
      currentSessionId !== undefined && sessionId !== undefined && currentSessionId === sessionId,
  }
}
