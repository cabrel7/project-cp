import { describe, expect, it } from 'vitest'
import LayoutWizard from '../../app/components/Cp/LayoutWizard.vue'
import { mountWithMode } from '../mode'

const steps = [{ label: 'Connecter' }, { label: 'Actions' }, { label: 'Publier' }]
const base = { steps, currentStep: 1 }

describe('CpLayoutWizard', () => {
  it('rend le Stepper', () => {
    const { wrapper } = mountWithMode(LayoutWizard, base)
    expect(wrapper.find('[data-cp-stepper]').exists()).toBe(true)
    expect(wrapper.findAll('li')).toHaveLength(3)
  })

  it('rend le slot default dans une colonne limitée à reading-max', () => {
    const { wrapper } = mountWithMode(LayoutWizard, base, {
      slots: { default: () => 'Contenu étape' },
    })
    expect(wrapper.get('[data-cp-layout-wizard]').classes()).toContain('max-w-reading-max')
    expect(wrapper.text()).toContain('Contenu étape')
  })

  it('les boutons Retour et Continuer émettent back / next', async () => {
    const { wrapper } = mountWithMode(LayoutWizard, base)
    const inner = wrapper.findComponent(LayoutWizard)
    await wrapper.get('[data-cp-back]').trigger('click')
    await wrapper.get('[data-cp-next]').trigger('click')
    expect(inner.emitted('back')).toHaveLength(1)
    expect(inner.emitted('next')).toHaveLength(1)
    expect(wrapper.get('[data-cp-back]').text()).toBe('Retour')
    expect(wrapper.get('[data-cp-next]').text()).toBe('Continuer')
  })

  it('libellés personnalisés', () => {
    const { wrapper } = mountWithMode(LayoutWizard, {
      ...base,
      nextLabel: 'Publier',
      backLabel: 'Précédent',
    })
    expect(wrapper.get('[data-cp-next]').text()).toBe('Publier')
    expect(wrapper.get('[data-cp-back]').text()).toBe('Précédent')
  })

  it('hideBackOnFirst masque Retour à l’étape 0 seulement', () => {
    const first = mountWithMode(LayoutWizard, { ...base, currentStep: 0, hideBackOnFirst: true })
    expect(first.wrapper.find('[data-cp-back]').exists()).toBe(false)
    const second = mountWithMode(LayoutWizard, { ...base, currentStep: 1, hideBackOnFirst: true })
    expect(second.wrapper.find('[data-cp-back]').exists()).toBe(true)
  })

  it('nextDisabled désactive Continuer', () => {
    const { wrapper } = mountWithMode(LayoutWizard, { ...base, nextDisabled: true })
    expect(wrapper.get('[data-cp-next]').attributes('disabled')).toBeDefined()
  })

  it('nextLoading désactive Continuer', () => {
    const { wrapper } = mountWithMode(LayoutWizard, { ...base, nextLoading: true })
    expect(wrapper.get('[data-cp-next]').attributes('disabled')).toBeDefined()
  })

  it('le slot advanced est dans un <details> fermé en Simple', () => {
    const { wrapper } = mountWithMode(LayoutWizard, base, {
      slots: { advanced: () => 'Délai' },
    })
    const details = wrapper.get('details')
    expect(details.text()).toContain('Délai')
    expect(details.get('summary').text()).toBe('Options avancées')
    expect(details.attributes('open')).toBeUndefined()
  })

  it('en Technique, <details> a l’attribut open', () => {
    const { wrapper } = mountWithMode(LayoutWizard, base, {
      technical: true,
      slots: { advanced: () => 'Délai' },
    })
    expect(wrapper.get('details').attributes('open')).toBeDefined()
  })

  it('pas de <details> sans slot advanced', () => {
    const { wrapper } = mountWithMode(LayoutWizard, base)
    expect(wrapper.find('details').exists()).toBe(false)
  })

  it('affiche summary à la dernière étape, default avant', () => {
    const slots = { default: () => 'Corps-du-formulaire', summary: () => 'Récapitulatif' }
    const mid = mountWithMode(LayoutWizard, base, { slots })
    expect(mid.wrapper.text()).toContain('Corps-du-formulaire')
    expect(mid.wrapper.text()).not.toContain('Récapitulatif')
    const last = mountWithMode(LayoutWizard, { ...base, currentStep: 2 }, { slots })
    expect(last.wrapper.text()).toContain('Récapitulatif')
    expect(last.wrapper.text()).not.toContain('Corps-du-formulaire')
  })

  it('le pied est collant (sticky)', () => {
    const { wrapper } = mountWithMode(LayoutWizard, base)
    const footer = wrapper.get('[data-cp-layout-wizard-footer]')
    expect(footer.element.tagName).toBe('FOOTER')
    expect(footer.classes()).toContain('sticky')
    expect(footer.classes()).toContain('bottom-0')
  })

  it('porte data-cp-layout-wizard', () => {
    const { wrapper } = mountWithMode(LayoutWizard, base)
    expect(wrapper.find('[data-cp-layout-wizard]').exists()).toBe(true)
  })
})
