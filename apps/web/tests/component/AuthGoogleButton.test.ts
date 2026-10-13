// @vitest-environment happy-dom
/**
 * P2.3 — bouton « Continuer avec Google » (charte : logo officiel, libellé exact, pleine largeur, tokens).
 * CA-25/CA-26 côté composant : libellé FR/EN, lien vers /v1/auth/oauth/google/start, hors ligne, aucune couleur en dur.
 */

import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import AuthGoogleButton from '../../app/components/AuthGoogleButton.vue'
import AuthSocialButtons from '../../app/components/AuthSocialButtons.vue'
import { i18n } from './i18n'
import { mocks } from './setup'

const render = (props: Record<string, unknown> = {}) => mount(AuthGoogleButton, { props })

beforeEach(() => {
  mocks.isOnline.value = true
  i18n.locale.value = 'fr'
})

describe('AuthGoogleButton', () => {
  it('doit afficher le libellé exact « Continuer avec Google » et le logo décoratif', () => {
    const wrapper = render()
    expect(wrapper.text()).toContain('Continuer avec Google')
    const logo = wrapper.get('img')
    expect(logo.attributes('src')).toBe('/brands/google-g.svg')
    expect(logo.attributes('alt')).toBe('')
    expect(logo.attributes('width')).toBe('20')
  })

  it('doit afficher « Continue with Google » en anglais', () => {
    i18n.locale.value = 'en'
    expect(render().text()).toContain('Continue with Google')
  })

  it('doit pointer vers /v1/auth/oauth/google/start avec next, remember_me et locale', () => {
    const url = new URL(
      render({ next: '/account/security', rememberMe: false }).get('a').attributes('href') ?? '',
      'http://localhost',
    )
    expect(url.pathname).toBe('/v1/auth/oauth/google/start')
    expect(url.searchParams.get('next')).toBe('/account/security')
    expect(url.searchParams.get('remember_me')).toBe('false')
    expect(url.searchParams.get('locale')).toBe('fr')
  })

  it('doit utiliser par défaut : next=/, remember_me=true', () => {
    const url = new URL(render().get('a').attributes('href') ?? '', 'http://localhost')
    expect(url.searchParams.get('next')).toBe('/')
    expect(url.searchParams.get('remember_me')).toBe('true')
  })

  it.each(['//evil.example/x', 'https://evil.example', '/\\evil'])(
    'doit remplacer un next hostile (%s) par « / »',
    (next) => {
      const url = new URL(render({ next }).get('a').attributes('href') ?? '', 'http://localhost')
      expect(url.searchParams.get('next')).toBe('/')
    },
  )

  it('doit transmettre la langue anglaise', () => {
    i18n.locale.value = 'en'
    const url = new URL(render().get('a').attributes('href') ?? '', 'http://localhost')
    expect(url.searchParams.get('locale')).toBe('en')
  })

  it('doit être désactivé hors ligne, sans lien, avec une explication lisible', () => {
    mocks.isOnline.value = false
    const wrapper = render()
    expect(wrapper.find('a').exists()).toBe(false)
    const button = wrapper.get('button')
    expect(button.attributes('disabled')).toBeDefined()
    const hint = wrapper.get('#cp-google-offline')
    expect(hint.text()).toContain('Connexion Internet requise')
    expect(button.attributes('aria-describedby')).toBe('cp-google-offline')
    expect(button.attributes('title')).toContain('Connexion Internet requise')
  })

  it('doit montrer un indicateur de chargement (logo remplacé) au clic, sans rendre le lien inerte', async () => {
    const wrapper = render()
    await wrapper.get('a').trigger('click')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(
      wrapper
        .find('[name="i-lucide-loader-circle"], [data-icon="i-lucide-loader-circle"]')
        .exists(),
    ).toBe(true)
  })

  it('ne doit contenir aucune couleur en dur (tokens du design system)', () => {
    const source = readFileSync('app/components/AuthGoogleButton.vue', 'utf8')
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(source).not.toMatch(/\brgb\(|\bhsl\(/)
  })
})

describe('AuthSocialButtons (CA-25 : indicateurs serveur)', () => {
  const render2 = () => mount(AuthSocialButtons)

  it('doit tout masquer sans réponse de /methods (échec fermé)', () => {
    mocks.methods.value = null
    const wrapper = render2()
    expect(wrapper.find('[data-testid="auth-social"]').exists()).toBe(false)
    expect(wrapper.find('[role="separator"]').exists()).toBe(false)
  })

  it('doit afficher Google seul avec séparateur « ou » quand {google:true, passkey:false, apple:false}', () => {
    mocks.methods.value = { google: true, passkey: false, apple: false }
    const wrapper = render2()
    expect(wrapper.get('[role="separator"]').text()).toBe('ou')
    expect(wrapper.findAll('img[alt=""]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="auth-apple"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="auth-passkey"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Apple')
  })

  it('doit n’afficher ni bouton ni séparateur quand google=false', () => {
    mocks.methods.value = { google: false, passkey: false, apple: false }
    const wrapper = render2()
    expect(wrapper.find('[data-testid="auth-social"]').exists()).toBe(false)
    expect(wrapper.find('[role="separator"]').exists()).toBe(false)
  })

  it('doit afficher clé d’accès et Apple seulement si le serveur les annonce', () => {
    mocks.methods.value = { google: true, passkey: true, apple: true }
    const wrapper = render2()
    expect(wrapper.find('[data-testid="auth-passkey"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="auth-apple"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="auth-google"]').exists()).toBe(true)
  })
})
