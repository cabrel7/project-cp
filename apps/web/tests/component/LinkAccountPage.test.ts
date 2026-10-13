// @vitest-environment happy-dom
/**
 * P2.3 — écran G8 /auth/link-account (CA-27 côté interface) : chargement, prêt, succès, annuler (navigation seule),
 * 404 expiré, réauthentification, e-mail non vérifié, déjà lié, 401.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthError } from '../../app/composables/useAuth'
import LinkAccountPage from '../../app/pages/auth/link-account.vue'
import { mocks } from './setup'

const err = (code: string, status: number, details: Record<string, unknown> = {}) =>
  new AuthError(code, status, 'req_1', details)

const pendingOk = { provider: 'google', email_masked: 'a***@gmail.com' }

async function mountPage() {
  const wrapper = mount(LinkAccountPage)
  await flushPromises()
  return wrapper
}
const confirm = (w: Awaited<ReturnType<typeof mountPage>>) => w.get('[data-cp-confirm]')

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  mocks.linkPending.mockResolvedValue(pendingOk)
  mocks.confirmLink.mockResolvedValue(undefined)
})

describe('/auth/link-account (G8)', () => {
  it('doit exiger le middleware d’authentification nommé `auth`', () => {
    mount(LinkAccountPage)
    expect(globalThis.definePageMeta).toHaveBeenCalledWith(
      expect.objectContaining({ middleware: 'auth' }),
    )
  })

  it('doit afficher l’e-mail masqué, « Lier le compte » (principal) et « Annuler »', async () => {
    const wrapper = await mountPage()
    expect(wrapper.get('h1').text()).toBe('Lier votre compte Google')
    expect(wrapper.text()).toContain(
      'Vous pourrez ensuite vous connecter avec Google (a***@gmail.com).',
    )
    expect(confirm(wrapper).text()).toBe('Lier le compte')
    expect(wrapper.get('[data-cp-cancel]').text()).toBe('Annuler')
  })

  it('doit désactiver l’action pendant le chargement et n’appeler rien au clic', async () => {
    mocks.linkPending.mockReturnValue(new Promise(() => undefined))
    const wrapper = mount(LinkAccountPage)
    await flushPromises()
    expect(confirm(wrapper).attributes('disabled')).toBeDefined()
    await confirm(wrapper).trigger('click')
    expect(mocks.confirmLink).not.toHaveBeenCalled()
  })

  it('doit afficher un squelette seulement si l’attente dépasse 300 ms', async () => {
    vi.useFakeTimers()
    mocks.linkPending.mockReturnValue(new Promise(() => undefined))
    const wrapper = mount(LinkAccountPage)
    await vi.advanceTimersByTimeAsync(200)
    expect(wrapper.find('[data-cp-skeleton]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    expect(wrapper.find('[data-cp-skeleton]').exists()).toBe(true)
    vi.useRealTimers()
  })

  it('doit confirmer la liaison puis aller à l’accueil', async () => {
    const wrapper = await mountPage()
    await confirm(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.confirmLink).toHaveBeenCalledTimes(1)
    expect(mocks.navigateTo).toHaveBeenCalledWith('/')
  })

  it('« Annuler » doit seulement naviguer, sans appel API', async () => {
    const wrapper = await mountPage()
    await wrapper.get('[data-cp-cancel]').trigger('click')
    expect(mocks.navigateTo).toHaveBeenCalledWith('/')
    expect(mocks.confirmLink).not.toHaveBeenCalled()
  })

  it('404 : « Cette demande a expiré » et une seule action « Continuer »', async () => {
    mocks.linkPending.mockRejectedValue(err('PLATFORM_RESOURCE_NOT_FOUND', 404))
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('Cette demande a expiré')
    expect(confirm(wrapper).text()).toBe('Continuer')
    expect(wrapper.find('[data-cp-cancel]').exists()).toBe(false)
    await confirm(wrapper).trigger('click')
    expect(mocks.navigateTo).toHaveBeenCalledWith('/')
  })

  it('AUTH_REAUTH_REQUIRED : explication + « Se reconnecter » (déconnexion puis connexion avec link=google)', async () => {
    const wrapper = await mountPage()
    mocks.confirmLink.mockRejectedValue(
      err('AUTH_REAUTH_REQUIRED', 403, { reason: 'login_before_link' }),
    )
    await confirm(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('reconnectez-vous')
    expect(confirm(wrapper).text()).toBe('Se reconnecter')
    await confirm(wrapper).trigger('click')
    expect(mocks.logout).toHaveBeenCalledWith('/auth/login?link=google')
  })

  it('AUTH_ACCOUNT_NOT_VERIFIED : « Renvoyer l’e-mail de vérification » puis confirmation d’envoi', async () => {
    mocks.linkPending.mockRejectedValue(
      err('AUTH_ACCOUNT_NOT_VERIFIED', 403, { reason: 'pending' }),
    )
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('Vérifiez d’abord votre adresse e-mail'.replace('’', "'"))
    expect(confirm(wrapper).text()).toBe("Renvoyer l'e-mail de vérification")
    await confirm(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.resendVerification).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('E-mail de vérification envoyé')
  })

  it.each([
    ['sub_linked_elsewhere', 'déjà lié à un autre compte'],
    ['provider_already_linked', 'Un compte Google est déjà lié au vôtre'],
  ])('AUTH_IDENTITY_ALREADY_LINKED (%s) : message précis + « Continuer »', async (reason, text) => {
    const wrapper = await mountPage()
    mocks.confirmLink.mockRejectedValue(err('AUTH_IDENTITY_ALREADY_LINKED', 409, { reason }))
    await confirm(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(text)
    expect(confirm(wrapper).text()).toBe('Continuer')
  })

  it('401 sur /link/pending : redirection vers /auth/login?link=google', async () => {
    mocks.linkPending.mockRejectedValue(err('AUTH_TOKEN_INVALID', 401))
    await mountPage()
    expect(mocks.navigateTo).toHaveBeenCalledWith('/auth/login?link=google')
  })

  it('erreur inattendue : message générique + « Réessayer » qui relance le chargement', async () => {
    mocks.linkPending.mockRejectedValueOnce(err('PLATFORM_INTERNAL_ERROR', 500))
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('Une erreur est survenue')
    expect(confirm(wrapper).text()).toBe('Réessayer')
    await confirm(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.linkPending).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('a***@gmail.com')
  })

  it('ne doit jamais afficher le code d’erreur brut', async () => {
    mocks.linkPending.mockRejectedValue(err('AUTH_ACCOUNT_NOT_VERIFIED', 403))
    const wrapper = await mountPage()
    expect(wrapper.text()).not.toContain('AUTH_')
  })
})
