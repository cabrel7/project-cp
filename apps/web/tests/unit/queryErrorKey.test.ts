/**
 * P2.3 — `?error=<CODE>[&reason=cancelled]` au retour de Google : liste blanche, jamais le paramètre brut (CA-26).
 */
import { describe, expect, it } from 'vitest'
import en from '../../../../packages/ui/i18n/locales/en.json'
import fr from '../../../../packages/ui/i18n/locales/fr.json'
import { queryErrorKey } from '../../app/utils/authErrors'

type Tree = { [key: string]: string | Tree }
const resolves = (tree: Tree, key: string): boolean => {
  let node: string | Tree | undefined = tree
  for (const part of key.split('.')) node = typeof node === 'object' ? node[part] : undefined
  return typeof node === 'string' && node.length > 0
}

const CODES = [
  'AUTH_SOCIAL_FLOW_INVALID',
  'AUTH_SOCIAL_EMAIL_UNVERIFIED',
  'AUTH_SOCIAL_PROVIDER_UNAVAILABLE',
  'AUTH_IDENTITY_ALREADY_LINKED',
  'AUTH_ACCOUNT_NOT_VERIFIED',
  'AUTH_LAST_SIGN_IN_METHOD',
  'AUTH_REAUTH_REQUIRED',
  'AUTH_ACCOUNT_SUSPENDED',
  'AUTH_SIGNUP_CLOSED',
  'PLATFORM_RATE_LIMIT',
]

describe('queryErrorKey', () => {
  it.each(CODES)('%s → une clé i18n qui existe en FR et en EN', (code) => {
    const key = queryErrorKey(code)
    expect(key).not.toBeNull()
    expect(resolves(fr as unknown as Tree, key as string)).toBe(true)
    expect(resolves(en as unknown as Tree, key as string)).toBe(true)
  })

  it('doit renvoyer null sans paramètre', () => {
    expect(queryErrorKey(undefined)).toBeNull()
    expect(queryErrorKey(null)).toBeNull()
    expect(queryErrorKey('')).toBeNull()
  })

  it.each([
    'NOPE',
    '<script>alert(1)</script>',
    '__proto__',
    'constructor',
    'AUTH_INVALID_CREDENTIALS',
  ])('code hors liste blanche (%s) → message générique', (value) => {
    expect(queryErrorKey(value)).toBe('cp.auth.genericError')
  })

  it('valeur non textuelle → générique ; tableau (?error=a&error=b) → première valeur', () => {
    expect(queryErrorKey(42)).toBe('cp.auth.genericError')
    expect(queryErrorKey({})).toBe('cp.auth.genericError')
    expect(queryErrorKey(['AUTH_SIGNUP_CLOSED', 'x'])).toBe('cp.auth.signupClosed')
  })

  it('reason=cancelled sur FLOW_INVALID → message neutre « annulée »', () => {
    expect(queryErrorKey('AUTH_SOCIAL_FLOW_INVALID', 'cancelled')).toBe('cp.auth.social.cancelled')
    expect(queryErrorKey('AUTH_SOCIAL_FLOW_INVALID', 'autre')).toBe(
      'cp.errors.AUTH_SOCIAL_FLOW_INVALID',
    )
    expect(queryErrorKey('AUTH_SIGNUP_CLOSED', 'cancelled')).toBe('cp.auth.signupClosed')
  })

  it('AUTH_IDENTITY_ALREADY_LINKED sans raison → clé « default » (une clé ne peut être à la fois texte et groupe)', () => {
    expect(queryErrorKey('AUTH_IDENTITY_ALREADY_LINKED')).toBe(
      'cp.errors.AUTH_IDENTITY_ALREADY_LINKED.default',
    )
  })
})

describe('i18n — parité FR/EN des clés P2.3', () => {
  const keys = (tree: Tree, prefix = ''): string[] =>
    Object.entries(tree).flatMap(([k, v]) =>
      typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
    )
  it.each(['cp.auth.social', 'cp.auth.link', 'cp.account', 'cp.errors'])(
    '%s : mêmes clés en FR et en EN, aucune valeur vide',
    (path) => {
      const pick = (t: unknown) =>
        path.split('.').reduce((n, p) => (n as Tree)[p], t as Tree) as Tree
      expect(keys(pick(fr)).sort()).toEqual(keys(pick(en)).sort())
      for (const tree of [pick(fr), pick(en)]) {
        for (const k of keys(tree)) expect(resolves(tree, k)).toBe(true)
      }
    },
  )
})
