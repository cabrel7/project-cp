import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OrgSelector from '../../app/components/Cp/OrgSelector.vue'

const props = { orgName: 'Groupe ELS', orgInitials: 'GE', planLabel: 'Formule Starter' }
const mountSelector = (extra: Record<string, unknown> = {}) =>
  mount(OrgSelector, { props: { ...props, ...extra } })

describe('CpOrgSelector', () => {
  it('doit afficher les initiales, le nom et le plan', () => {
    const wrapper = mountSelector()
    expect(wrapper.get('[data-cp-org-initials]').text()).toBe('GE')
    expect(wrapper.text()).toContain('Groupe ELS')
    expect(wrapper.get('[data-cp-org-plan]').text()).toBe('Formule Starter')
  })

  it('doit placer les initiales dans une pastille bg-cp-amber-soft', () => {
    expect(mountSelector().get('[data-cp-org-initials]').classes()).toContain('bg-cp-amber-soft')
  })

  it('doit tronquer le nom (classe truncate) sans casser le plan', () => {
    const wrapper = mountSelector({ orgName: 'Une organisation au nom vraiment très très long' })
    const name = wrapper.findAll('span.truncate')
    expect(name).toHaveLength(1)
    expect(name[0]?.text()).toBe('Une organisation au nom vraiment très très long')
    expect(wrapper.get('[data-cp-org-plan]').text()).toBe('Formule Starter')
  })

  it('doit émettre switch au clic', async () => {
    const wrapper = mountSelector()
    await wrapper.trigger('click')
    expect(wrapper.emitted('switch')).toHaveLength(1)
  })

  it('doit être un bouton natif (clavier), type="button"', () => {
    const root = mountSelector()
    expect(root.element.tagName).toBe('BUTTON')
    expect(root.attributes('type')).toBe('button')
  })

  it('doit avoir un aria-label contenant le nom de l organisation', () => {
    const label = mountSelector().attributes('aria-label')
    expect(label).toContain('Groupe ELS')
    expect(label).toContain("Changer d'organisation")
  })

  it('doit cacher les initiales aux lecteurs d écran (le nom est dans aria-label)', () => {
    expect(mountSelector().get('[data-cp-org-initials]').attributes('aria-hidden')).toBe('true')
  })

  it('doit exposer les data-attributes data-cp-org-*', () => {
    const wrapper = mountSelector()
    expect(wrapper.attributes('data-cp-org-selector')).toBeDefined()
    expect(wrapper.find('[data-cp-org-initials]').exists()).toBe(true)
    expect(wrapper.find('[data-cp-org-plan]').exists()).toBe(true)
  })

  it('doit afficher l icône de bascule', () => {
    expect(mountSelector().find('[data-icon="i-lucide-chevrons-up-down"]').exists()).toBe(true)
  })

  it('doit échapper le nom (pas d injection HTML)', () => {
    const wrapper = mountSelector({ orgName: '<img src=x onerror=alert(1)>' })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  })
})
