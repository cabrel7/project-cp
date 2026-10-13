// @vitest-environment happy-dom
/**
 * P2.3 — page G5 /account/security et section « Moyens de connexion » (CA-28 côté interface) :
 * chargement, erreur + réessayer, succès, lier, délier (confirmation), garde-fous (dernier moyen, réauth), e-mail non vérifié.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthError } from '../../app/composables/useAuth'
import SecurityPage from '../../app/pages/account/security.vue'
import { mocks } from './setup'

const err = (code: string, status: number, details: Record<string, unknown> = {}) =>
  new AuthError(code, status, 'req_1', details)

const base = {
  id: '01900000-0000-7000-8000-000000000002',
  email: 'awa@boutique-exemple.cm',
  email_verified: true,
  full_name: 'Awa Nkeng',
  locale: 'fr',
  timezone: 'Africa/Douala',
  created_at: '2026-10-12T10:00:00.000Z',
  phone: null,
  phone_verified: false,
  has_password: true,
  identities: [] as { provider: 'google'; email: string | null; linked_at: string }[],
}
const google = {
  provider: 'google' as const,
  email: 'awa@gmail.com',
  linked_at: '2026-10-13T08:00:00Z',
}

async function mountPage(me: unknown = base) {
  mocks.user.value = me
  mocks.fetchMe.mockResolvedValue(me)
  const wrapper = mount(SecurityPage)
  await flushPromises()
  return wrapper
}
const row = (w: Awaited<ReturnType<typeof mountPage>>, name: string) =>
  w.get(`[data-testid="method-${name}"]`)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  mocks.user.value = null
  mocks.route.query = {}
})

describe('/account/security — section « Moyens de connexion »', () => {
  it('doit exiger le middleware `auth` et afficher le titre de la page', async () => {
    const wrapper = await mountPage()
    expect(globalThis.definePageMeta).toHaveBeenCalledWith(
      expect.objectContaining({ middleware: 'auth' }),
    )
    expect(wrapper.get('h1').text()).toBe('Sécurité du compte')
    expect(wrapper.text()).toContain('Moyens de connexion')
  })

  it('doit afficher mot de passe défini (icône + mot), téléphone non ajouté, Google non lié', async () => {
    const wrapper = await mountPage()
    expect(row(wrapper, 'password').text()).toContain('Défini')
    expect(row(wrapper, 'password').find('[data-icon="i-lucide-circle-check"]').exists()).toBe(true)
    expect(row(wrapper, 'phone').text()).toContain('Non ajouté')
    expect(row(wrapper, 'google').text()).toContain('Non lié')
  })

  it('doit proposer « Définir un mot de passe » quand aucun mot de passe n’est défini', async () => {
    const wrapper = await mountPage({ ...base, has_password: false })
    expect(row(wrapper, 'password').text()).toContain('Non défini')
    const link = row(wrapper, 'password').get('a')
    expect(link.text()).toBe('Définir un mot de passe')
    expect(link.attributes('href')).toBe('/auth/forgot-password')
  })

  it('doit afficher le numéro vérifié', async () => {
    const wrapper = await mountPage({ ...base, phone: '+237670000101', phone_verified: true })
    expect(row(wrapper, 'phone').text()).toContain('+237670000101')
  })

  it('« Lier Google » est l’unique action principale quand Google n’est pas lié', async () => {
    const wrapper = await mountPage()
    const link = wrapper.get('[data-testid="link-google"]')
    expect(link.text()).toBe('Lier Google')
    expect(link.attributes('data-color')).toBeUndefined()
    expect(wrapper.find('[data-testid="unlink-google"]').exists()).toBe(false)
  })

  it('« Lier Google » doit appeler l’API avec le retour /account/security', async () => {
    mocks.startLinkFromSession.mockResolvedValue(undefined)
    const wrapper = await mountPage()
    await wrapper.get('[data-testid="link-google"]').trigger('click')
    expect(mocks.startLinkFromSession).toHaveBeenCalledWith('/account/security')
  })

  it('e-mail non vérifié : « Lier Google » masqué avec explication', async () => {
    const wrapper = await mountPage({ ...base, email_verified: false })
    expect(wrapper.find('[data-testid="link-google"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="verify-email-first"]').text()).toContain(
      'Vérifiez votre adresse e-mail pour lier Google.',
    )
  })

  it('compte sans e-mail (téléphone seul) : « Lier Google » masqué', async () => {
    const wrapper = await mountPage({ ...base, email: null, email_verified: false })
    expect(wrapper.find('[data-testid="link-google"]').exists()).toBe(false)
  })

  it('Google lié : « Lié · e-mail » (icône + mot) et « Délier Google » neutre', async () => {
    const wrapper = await mountPage({ ...base, identities: [google] })
    expect(row(wrapper, 'google').text()).toContain('Lié · awa@gmail.com')
    const unlink = wrapper.get('[data-testid="unlink-google"]')
    expect(unlink.attributes('data-color')).toBe('neutral')
    expect(wrapper.find('[data-testid="link-google"]').exists()).toBe(false)
  })

  it('« Délier » demande une confirmation, n’appelle l’API qu’après, puis recharge', async () => {
    mocks.unlink.mockResolvedValue(undefined)
    const wrapper = await mountPage({ ...base, identities: [google] })
    await wrapper.get('[data-testid="unlink-google"]').trigger('click')
    expect(mocks.unlink).not.toHaveBeenCalled()
    expect(document.body.textContent + wrapper.text()).toContain(
      'Vous ne pourrez plus vous connecter avec ce compte Google.',
    )
    await wrapper.get('[data-cp-confirm]').trigger('click')
    await flushPromises()
    expect(mocks.unlink).toHaveBeenCalledWith('google')
    expect(wrapper.get('[data-testid="security-unlinked"]').text()).toContain(
      "Google n'est plus lié à votre compte.",
    )
    expect(mocks.fetchMe).toHaveBeenCalledTimes(1)
  })

  it('« Annuler » dans la confirmation ne délie rien', async () => {
    const wrapper = await mountPage({ ...base, identities: [google] })
    await wrapper.get('[data-testid="unlink-google"]').trigger('click')
    await wrapper.get('[data-cp-cancel]').trigger('click')
    expect(mocks.unlink).not.toHaveBeenCalled()
  })

  it('409 AUTH_LAST_SIGN_IN_METHOD : message + « Définir un mot de passe »', async () => {
    mocks.unlink.mockRejectedValue(err('AUTH_LAST_SIGN_IN_METHOD', 409))
    const wrapper = await mountPage({ ...base, has_password: false, identities: [google] })
    await wrapper.get('[data-testid="unlink-google"]').trigger('click')
    await wrapper.get('[data-cp-confirm]').trigger('click')
    await flushPromises()
    const failure = wrapper.get('[data-testid="security-failure"]')
    expect(failure.text()).toContain("Ajoutez d'abord un mot de passe ou un téléphone")
    const action = failure.findAll('button').find((b) => b.text() === 'Définir un mot de passe')
    expect(action).toBeDefined()
    await action?.trigger('click')
    expect(mocks.navigateTo).toHaveBeenCalledWith('/auth/forgot-password')
  })

  it('403 AUTH_REAUTH_REQUIRED : « Se reconnecter » → déconnexion puis retour sur la page', async () => {
    mocks.unlink.mockRejectedValue(err('AUTH_REAUTH_REQUIRED', 403))
    const wrapper = await mountPage({ ...base, identities: [google] })
    await wrapper.get('[data-testid="unlink-google"]').trigger('click')
    await wrapper.get('[data-cp-confirm]').trigger('click')
    await flushPromises()
    const failure = wrapper.get('[data-testid="security-failure"]')
    expect(failure.text()).toContain('reconnectez-vous')
    await failure
      .findAll('button')
      .find((b) => b.text() === 'Se reconnecter')
      ?.trigger('click')
    expect(mocks.logout).toHaveBeenCalledWith('/auth/login?next=/account/security')
  })

  it.each([
    [
      'AUTH_IDENTITY_ALREADY_LINKED',
      409,
      { reason: 'provider_already_linked' },
      'déjà lié au vôtre',
    ],
    ['PLATFORM_RATE_LIMIT', 429, {}, 'Trop de tentatives'],
    ['AUTH_ACCOUNT_NOT_VERIFIED', 403, { reason: 'pending' }, "Ouvrez l'e-mail de vérification"],
  ])('lier : %s → message i18n, jamais le code', async (code, status, details, text) => {
    mocks.startLinkFromSession.mockRejectedValue(err(code, status, details))
    const wrapper = await mountPage()
    await wrapper.get('[data-testid="link-google"]').trigger('click')
    await flushPromises()
    const failure = wrapper.get('[data-testid="security-failure"]')
    expect(failure.text()).toContain(text)
    expect(failure.text()).not.toContain('AUTH_')
    expect(wrapper.get('[data-testid="link-google"]').attributes('disabled')).toBeUndefined()
  })

  it('?linked=google : alerte de succès', async () => {
    mocks.route.query = { linked: 'google' }
    const wrapper = await mountPage({ ...base, identities: [google] })
    expect(wrapper.get('[data-testid="security-notice"]').text()).toContain(
      'Google est lié à votre compte.',
    )
  })

  it('?error=<CODE> : message i18n ; valeur inconnue : message générique, jamais le paramètre', async () => {
    mocks.route.query = { error: 'AUTH_IDENTITY_ALREADY_LINKED' }
    let wrapper = await mountPage()
    expect(wrapper.get('[data-testid="security-notice"]').text()).toContain('déjà lié')
    mocks.route.query = { error: '<script>alert(1)</script>' }
    wrapper = await mountPage()
    expect(wrapper.get('[data-testid="security-notice"]').text()).toContain(
      'Une erreur est survenue',
    )
    expect(wrapper.text()).not.toContain('<script>')
  })

  it('erreur de chargement : alerte avec « Réessayer » puis affichage', async () => {
    mocks.user.value = null
    mocks.fetchMe.mockRejectedValueOnce(err('PLATFORM_INTERNAL_ERROR', 500))
    const wrapper = mount(SecurityPage)
    await flushPromises()
    const alert = wrapper.get('[data-testid="security-load-error"]')
    expect(alert.text()).toContain("Nous n'arrivons pas à afficher")
    mocks.fetchMe.mockImplementation(async () => {
      mocks.user.value = base
      return base
    })
    await alert.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="sign-in-methods"]').exists()).toBe(true)
  })

  it('squelette seulement après 300 ms d’attente', async () => {
    vi.useFakeTimers()
    mocks.user.value = null
    mocks.fetchMe.mockReturnValue(new Promise(() => undefined))
    const wrapper = mount(SecurityPage)
    await vi.advanceTimersByTimeAsync(100)
    expect(wrapper.find('[data-cp-skeleton]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(300)
    expect(wrapper.find('[data-cp-skeleton]').exists()).toBe(true)
    vi.useRealTimers()
  })

  it('sans session (fetchMe → null) : redirection vers /auth/login?next=/account/security', async () => {
    mocks.user.value = null
    mocks.fetchMe.mockResolvedValue(null)
    mount(SecurityPage)
    await flushPromises()
    expect(mocks.navigateTo).toHaveBeenCalledWith('/auth/login?next=/account/security')
  })
})
