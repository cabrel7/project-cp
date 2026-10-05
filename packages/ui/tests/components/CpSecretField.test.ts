import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SecretField from '../../app/components/Cp/SecretField.vue'

const SECRET = 'sk_live_4fT9xQ2mZ'

describe('CpSecretField', () => {
  const writeText = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    writeText.mockClear()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  })

  it('masque la valeur par défaut sans la laisser dans le DOM', () => {
    const wrapper = mount(SecretField, { props: { value: SECRET } })
    const shown = wrapper.get('[data-cp-secret-value]').text()
    expect(shown).toMatch(/^•+$/)
    expect(wrapper.html()).not.toContain(SECRET)
  })

  it('le masque ne révèle pas la longueur du secret', () => {
    const a = mount(SecretField, { props: { value: 'abc' } })
      .get('[data-cp-secret-value]')
      .text()
    const b = mount(SecretField, { props: { value: SECRET.repeat(3) } })
      .get('[data-cp-secret-value]')
      .text()
    expect(a).toBe(b)
  })

  it('affiche le libellé', () => {
    expect(
      mount(SecretField, { props: { value: SECRET, label: 'Clé d’accès' } })
        .get('[data-label]')
        .text(),
    ).toBe('Clé d’accès')
  })

  it('bascule afficher / masquer avec aria-pressed et libellé accessible', async () => {
    const wrapper = mount(SecretField, { props: { value: SECRET } })
    const toggle = wrapper.get('[data-cp-toggle]')
    expect(toggle.attributes('aria-label')).toBe('Afficher')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    expect(toggle.attributes('data-icon')).toBe('i-lucide-eye')

    await toggle.trigger('click')
    expect(wrapper.get('[data-cp-secret-value]').text()).toBe(SECRET)
    expect(wrapper.get('[data-cp-secret-value]').classes()).toContain('font-mono')
    expect(toggle.attributes('aria-label')).toBe('Masquer')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(toggle.attributes('data-icon')).toBe('i-lucide-eye-off')

    await toggle.trigger('click')
    expect(wrapper.get('[data-cp-secret-value]').text()).toMatch(/^•+$/)
  })

  it('pas de bouton Copier sans copyable', () => {
    expect(
      mount(SecretField, { props: { value: SECRET } })
        .find('[data-cp-copy]')
        .exists(),
    ).toBe(false)
  })

  it('copie la vraie valeur même masquée, puis confirme « Copié »', async () => {
    const wrapper = mount(SecretField, { props: { value: SECRET, copyable: true } })
    const copy = wrapper.get('[data-cp-copy]')
    expect(copy.attributes('aria-label')).toBe('Copier')
    await copy.trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(SECRET)
    expect(copy.attributes('aria-label')).toBe('Copié')
    expect(wrapper.get('[aria-live="polite"]').text()).toBe('Copié')
  })

  it('presse-papiers indisponible : pas d’erreur, pas de faux « Copié »', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'))
    const wrapper = mount(SecretField, { props: { value: SECRET, copyable: true } })
    await wrapper.get('[data-cp-copy]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-cp-copy]').attributes('aria-label')).toBe('Copier')
  })

  it('avertissement « affiché une fois » optionnel', () => {
    expect(
      mount(SecretField, { props: { value: SECRET } })
        .find('[data-cp-warning]')
        .exists(),
    ).toBe(false)
    const warning = mount(SecretField, { props: { value: SECRET, warning: true } }).get(
      '[data-cp-warning]',
    )
    expect(warning.text()).toContain('Vous ne pourrez plus la voir')
    expect(warning.find('[data-icon]').exists()).toBe(true)
  })
})
