/**
 * P2.3 — règle P-2 « Google fait autorité sur l'adresse » (proposition de sécurité à confirmer par Dylan, spec §1.2).
 * `email_verified === true` (booléen ou la chaîne "true") NE SUFFIT PAS : pour une adresse tierce (@yahoo.fr…), un
 * tiers peut avoir créé un compte Google avec l'adresse d'autrui (pre-hijacking). On n'accepte l'e-mail que si
 *   (a) le domaine est gmail.com ou googlemail.com (casse ignorée), OU
 *   (b) `hd` (domaine Google Workspace) est non vide et égal au domaine de l'e-mail.
 * Fonction PURE, facile à assouplir (spec : « une fonction pure »). L'e-mail accepté est normalisé en minuscules.
 *
 * CONTRAT : `evaluateGoogleEmail(claims)` → `{ ok: true, email }` | `{ ok: false }` (module `oauth/google.id-token.ts`).
 * Phase RED : module absent (import dynamique, un échec par test).
 */
import { describe, expect, it } from 'vitest'
import { loadSrc } from './phone-test-utils.js'

type Mod = typeof import('../oauth/google.id-token.js')
const mod = () => loadSrc<Mod>('../oauth/google.id-token.js')

type Claims = { email?: unknown; email_verified?: unknown; hd?: unknown }

async function evaluate(claims: Claims) {
  const { evaluateGoogleEmail } = await mod()
  return evaluateGoogleEmail(claims as never) as { ok: boolean; email?: string }
}

describe('evaluateGoogleEmail — acceptés (CA-11)', () => {
  it.each([
    [
      'X@GMAIL.COM',
      true,
      undefined,
      'x@gmail.com',
      'Gmail en majuscules, e-mail normalisé en minuscules',
    ],
    ['x@googlemail.com', true, undefined, 'x@googlemail.com', 'googlemail.com'],
    ['x@company.cm', true, 'company.cm', 'x@company.cm', 'Workspace : hd égal au domaine'],
    ['x@gmail.com', 'true', undefined, 'x@gmail.com', 'email_verified en chaîne "true"'],
    ['Awa.Nkeng@Gmail.com', true, undefined, 'awa.nkeng@gmail.com', 'casse mixte'],
    ['x@gmail.com', true, 'other.cm', 'x@gmail.com', 'Gmail : un hd étranger ne change rien'],
  ])(
    'doit accepter %s (verified=%j, hd=%j) → %s (%s)',
    async (email, verified, hd, expected, _label) => {
      const result = await evaluate({ email, email_verified: verified, ...(hd ? { hd } : {}) })
      expect(result).toEqual({ ok: true, email: expected })
    },
  )
})

describe('evaluateGoogleEmail — refusés (CA-11)', () => {
  it.each([
    [{ email: 'x@gmail.com', email_verified: false }, 'email_verified = false'],
    [{ email: 'x@gmail.com', email_verified: 'false' }, 'email_verified = "false"'],
    [
      { email: 'x@gmail.com', email_verified: 1 },
      'email_verified numérique (ni booléen ni "true")',
    ],
    [
      { email: 'x@gmail.com', email_verified: 'TRUE' },
      'email_verified "TRUE" (seul "true" est admis)',
    ],
    [{ email: 'x@gmail.com' }, 'email_verified absent'],
    [{ email_verified: true }, 'e-mail absent'],
    [{ email: '', email_verified: true }, 'e-mail vide'],
    [{ email: 'x@yahoo.fr', email_verified: true }, 'adresse tierce sans hd (pre-hijacking)'],
    [{ email: 'x@company.cm', email_verified: true, hd: 'other.cm' }, 'hd différent du domaine'],
    [{ email: 'x@company.cm', email_verified: true, hd: '' }, 'hd vide'],
    [{ email: 'x@company.cm', email_verified: true, hd: 42 }, 'hd non textuel'],
    [{ email: 'x@sub.gmail.com', email_verified: true }, 'sous-domaine de gmail.com'],
    [{ email: 'x@notgmail.com', email_verified: true }, 'domaine qui finit par gmail.com'],
    [
      { email: 'x@gmail.com.evil.test', email_verified: true },
      'domaine qui commence par gmail.com',
    ],
    [{ email: 'a@b@gmail.com', email_verified: true }, 'plusieurs @ (analyse ambiguë du domaine)'],
    [{ email: 'gmail.com', email_verified: true }, 'pas de @'],
    [{ email: 42, email_verified: true }, 'e-mail non textuel'],
  ] as [Claims, string][])('doit refuser %j (%s)', async (claims) => {
    const result = await evaluate(claims)
    expect(result.ok).toBe(false)
    expect(result.email).toBeUndefined()
  })
})
