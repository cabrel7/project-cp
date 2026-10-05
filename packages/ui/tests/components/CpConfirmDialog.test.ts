import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ConfirmDialog from '../../app/components/Cp/ConfirmDialog.vue'

const base = { open: true, title: "Supprimer l'assistant Relances ?" }

describe('CpConfirmDialog', () => {
  it('ne rend rien quand il est fermé', () => {
    const wrapper = mount(ConfirmDialog, { props: { ...base, open: false } })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('affiche titre et description', () => {
    const wrapper = mount(ConfirmDialog, {
      props: { ...base, description: 'Les relances en cours seront arrêtées.' },
    })
    expect(wrapper.get('[data-title]').text()).toBe(base.title)
    expect(wrapper.get('[data-description]').text()).toBe('Les relances en cours seront arrêtées.')
    expect(wrapper.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
  })

  it('utilise les libellés i18n par défaut', () => {
    const wrapper = mount(ConfirmDialog, { props: base })
    expect(wrapper.get('[data-cp-confirm]').text()).toBe('Confirmer')
    expect(wrapper.get('[data-cp-cancel]').text()).toBe('Annuler')
  })

  it('variante danger : bouton danger et libellé « Supprimer »', () => {
    const wrapper = mount(ConfirmDialog, { props: { ...base, variant: 'danger' } })
    const confirm = wrapper.get('[data-cp-confirm]')
    expect(confirm.attributes('data-color')).toBe('error')
    expect(confirm.text()).toBe('Supprimer')
  })

  it.each(['warning', 'default'] as const)('variante %s : bouton principal', (variant) => {
    const confirm = mount(ConfirmDialog, { props: { ...base, variant } }).get('[data-cp-confirm]')
    expect(confirm.attributes('data-color')).toBe('primary')
  })

  it('respecte les libellés fournis', () => {
    const wrapper = mount(ConfirmDialog, {
      props: { ...base, confirmLabel: 'Arrêter les relances', cancelLabel: 'Garder' },
    })
    expect(wrapper.get('[data-cp-confirm]').text()).toBe('Arrêter les relances')
    expect(wrapper.get('[data-cp-cancel]').text()).toBe('Garder')
  })

  it('émet confirm et cancel', async () => {
    const wrapper = mount(ConfirmDialog, { props: base })
    await wrapper.get('[data-cp-confirm]').trigger('click')
    await wrapper.get('[data-cp-cancel]').trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('émet cancel à la fermeture (Échap / voile)', async () => {
    const wrapper = mount(ConfirmDialog, { props: base })
    await wrapper.get('[data-close]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('pendant le chargement : pas de fermeture, annuler désactivé, confirmer en chargement', async () => {
    const wrapper = mount(ConfirmDialog, { props: { ...base, loading: true } })
    expect(wrapper.get('[role="dialog"]').attributes('data-dismissible')).toBe('false')
    expect(wrapper.get('[data-cp-cancel]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-cp-confirm]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-close]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })
})
