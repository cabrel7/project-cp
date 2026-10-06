import { describe, expect, it } from 'vitest'
import { toMeResponse, toSessionResponse } from '../auth.resource.js'

const baseUser = {
  publicId: '0190a000-0000-7000-8000-000000000001',
  email: 'alice@example.com',
  emailVerifiedAt: '2025-12-02T00:00:00.000Z' as string | null,
  fullName: 'Alice' as string | null,
  locale: 'fr',
  timezone: 'Europe/Paris',
  createdAt: '2025-12-01T00:00:00.000Z',
  phoneE164: null as string | null,
  phoneVerifiedAt: null as string | null,
  freeTierEligible: false,
}

describe('toMeResponse', () => {
  it('doit mapper un utilisateur en réponse API (snake_case, id = public_id)', () => {
    expect(toMeResponse(baseUser)).toEqual({
      id: baseUser.publicId,
      email: 'alice@example.com',
      email_verified: true,
      full_name: 'Alice',
      locale: 'fr',
      timezone: 'Europe/Paris',
      created_at: '2025-12-01T00:00:00.000Z',
      phone: null,
      phone_verified: false,
      free_tier_eligible: false,
    })
  })

  it('P2.2 : doit exposer phone, phone_verified et free_tier_eligible pour un utilisateur téléphone', () => {
    const res = toMeResponse({
      ...baseUser,
      email: null,
      emailVerifiedAt: null,
      phoneE164: '+237690123442',
      phoneVerifiedAt: '2026-10-06T10:00:00.000Z',
      freeTierEligible: true,
    })
    expect(res.phone).toBe('+237690123442')
    expect(res.phone_verified).toBe(true)
    expect(res.email).toBeNull()
    expect(res.free_tier_eligible).toBe(true)
  })

  it('doit indiquer email_verified=false quand emailVerifiedAt est null', () => {
    expect(toMeResponse({ ...baseUser, emailVerifiedAt: null }).email_verified).toBe(false)
  })

  it('doit propager les valeurs nulles (email, nom)', () => {
    const res = toMeResponse({ ...baseUser, email: null, fullName: null })
    expect(res.email).toBeNull()
    expect(res.full_name).toBeNull()
  })

  it('ne doit exposer aucun champ interne (id bigint, hash, statut)', () => {
    const res = toMeResponse({
      ...baseUser,
      id: 42n,
      passwordHash: 'secret',
      status: 'active',
    } as never)
    expect(Object.keys(res).sort()).toEqual([
      'created_at',
      'email',
      'email_verified',
      'free_tier_eligible',
      'full_name',
      'id',
      'locale',
      'phone',
      'phone_verified',
      'timezone',
    ])
  })
})

describe('toSessionResponse', () => {
  const session = {
    publicId: '0190a000-0000-7000-8000-0000000000aa',
    ip: '1.2.3.4',
    userAgent: 'UA',
    deviceLabel: 'Laptop' as string | null,
    createdAt: '2025-12-01T00:00:00.000Z',
    lastSeenAt: '2025-12-03T00:00:00.000Z',
  }

  it('doit mapper une session et marquer is_current=true quand les ids correspondent', () => {
    expect(toSessionResponse(session, 5n, 5n)).toEqual({
      id: session.publicId,
      ip: '1.2.3.4',
      user_agent: 'UA',
      device_label: 'Laptop',
      created_at: '2025-12-01T00:00:00.000Z',
      last_seen_at: '2025-12-03T00:00:00.000Z',
      is_current: true,
    })
  })

  it('doit marquer is_current=false quand les ids diffèrent', () => {
    expect(toSessionResponse(session, 5n, 6n).is_current).toBe(false)
  })

  it('doit marquer is_current=false quand currentSessionId est absent', () => {
    expect(toSessionResponse(session, undefined, 5n).is_current).toBe(false)
  })

  it('doit marquer is_current=false quand sessionId est absent', () => {
    expect(toSessionResponse(session, 5n).is_current).toBe(false)
    expect(toSessionResponse(session).is_current).toBe(false)
  })

  it('doit traiter 0n comme un identifiant valide (pas de confusion avec « absent »)', () => {
    expect(toSessionResponse(session, 0n, 0n).is_current).toBe(true)
  })

  it('doit propager les valeurs nulles (ip, user agent, libellé)', () => {
    const res = toSessionResponse({ ...session, ip: null, userAgent: null, deviceLabel: null })
    expect(res.ip).toBeNull()
    expect(res.user_agent).toBeNull()
    expect(res.device_label).toBeNull()
  })
})
