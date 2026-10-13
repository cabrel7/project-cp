/**
 * Les routes de navigation (`/start`, `/callback`) ne répondent JAMAIS en JSON : toute erreur devient une redirection
 * vers l'origine `APP_URL` avec `?error=<CODE du catalogue>` (jamais un message, jamais une valeur du fournisseur).
 */
import type { Context } from 'hono'
import { setCookie } from 'hono/cookie'
import type { AppEnv } from '../../../context.js'
import { getEnv } from '../../../env.js'
import { type CallbackOutcome, isAppError } from './oauth.service.js'

function appUrl(path: string, query: Record<string, string> = {}): string {
  const url = new URL(path, getEnv().APP_URL)
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  return url.toString()
}

export function setCookieHeader(
  c: Context<AppEnv>,
  name: string,
  value: string,
  path: string,
  maxAge: number,
): void {
  setCookie(c, name, value, {
    httpOnly: true,
    sameSite: 'Lax',
    path,
    maxAge,
    secure: getEnv().NODE_ENV === 'production',
  })
}

/** Exécute `fn` ; une erreur du catalogue (ou imprévue, journalisée) devient une redirection vers `fallbackPath`. */
export async function redirectError(
  c: Context<AppEnv>,
  fallbackPath: string,
  fn: () => Promise<Response>,
  cleanup?: () => void,
): Promise<Response> {
  try {
    return await fn()
  } catch (err) {
    cleanup?.()
    if (isAppError(err)) return c.redirect(appUrl(fallbackPath, { error: err.code }), 302)
    c.get('logger')?.error({ err }, 'oauth redirect route failed')
    return c.redirect(appUrl(fallbackPath, { error: 'AUTH_SOCIAL_PROVIDER_UNAVAILABLE' }), 302)
  }
}

/** Redirection finale du rappel (le cookie de flux est déjà effacé par l'appelant). */
export function redirectTo(
  c: Context<AppEnv>,
  outcome: CallbackOutcome,
  linkCookie: string,
  linkPath: string,
): Response {
  switch (outcome.kind) {
    case 'session': {
      const env = getEnv()
      setCookie(c, env.SESSION_COOKIE_NAME, outcome.token, {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: outcome.maxAge,
        secure: env.NODE_ENV === 'production',
      })
      return c.redirect(appUrl(outcome.next), 302)
    }
    case 'pending_link':
      setCookieHeader(c, linkCookie, outcome.linkCookie, linkPath, 600)
      return c.redirect(appUrl('/auth/login', { link: 'google' }), 302)
    case 'linked':
      return c.redirect(appUrl(outcome.next, { linked: 'google' }), 302)
    case 'error': {
      const query: Record<string, string> = { error: outcome.code }
      if (outcome.reason === 'cancelled') query.reason = 'cancelled'
      const target = outcome.intent === 'link' ? outcome.next : '/auth/login'
      return c.redirect(appUrl(target, query), 302)
    }
  }
}

/** Paramètre invalide (ex. paramètre répété) : jamais de 422 JSON sur une navigation. */
export function redirectInvalid(c: Context<AppEnv>, cleanup?: () => void): Response {
  cleanup?.()
  return c.redirect(appUrl('/auth/login', { error: 'AUTH_SOCIAL_FLOW_INVALID' }), 302)
}
