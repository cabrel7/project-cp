import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import LayoutSettings from '../../app/components/Cp/LayoutSettings.vue'
import PageHeader from '../../app/components/Cp/PageHeader.vue'
import { mountWithMode } from '../mode'

const sections = [
  { value: 'profile', label: 'Profil', icon: 'i-lucide-user' },
  { value: 'billing', label: 'Facturation' },
  { value: 'danger', label: 'Zone dangereuse', danger: true },
]

const render = (
  section = 'profile',
  slots: Record<string, () => unknown> = {},
  onUpdate?: (v: string) => void,
) => {
  const { wrapper } = mountWithMode(
    LayoutSettings,
    {
      title: 'Réglages',
      description: 'Gérez votre organisation.',
      sections,
      section,
      'onUpdate:section': onUpdate,
    },
    { slots },
  )
  return wrapper
}

describe('CpLayoutSettings', () => {
  it('rend le PageHeader', () => {
    const wrapper = mount(LayoutSettings, {
      props: { title: 'Réglages', description: 'Desc', sections, section: 'profile' },
      global: { components: { CpPageHeader: PageHeader } },
    })
    expect(wrapper.get('[data-cp-page-header] h1').text()).toBe('Réglages')
    expect(wrapper.get('[data-cp-page-header] p').text()).toBe('Desc')
  })

  it('rend la navigation avec tous les items', () => {
    const items = render().findAll('nav li button')
    expect(items.map((b) => b.text())).toEqual(['Profil', 'Facturation', 'Zone dangereuse'])
    expect(render().find('nav [data-icon="i-lucide-user"]').exists()).toBe(true)
    expect(render().get('nav').attributes('aria-label')).toBeTruthy()
  })

  it('met la section active en bg-cp-primary-soft avec aria-current', () => {
    const [profile, billing] = render('profile').findAll('nav button')
    expect(profile?.classes()).toContain('bg-cp-primary-soft')
    expect(profile?.attributes('aria-current')).toBe('true')
    expect(billing?.classes()).not.toContain('bg-cp-primary-soft')
    expect(billing?.attributes('aria-current')).toBeUndefined()
  })

  it('le clic change le model et émet navigate-section', async () => {
    const model = ref('profile')
    const wrapper = render('profile', {}, (v) => {
      model.value = v
    })
    await wrapper.findAll('nav button')[1]?.trigger('click')
    expect(model.value).toBe('billing')
    const inner = wrapper.findComponent(LayoutSettings)
    expect(inner.emitted('navigate-section')).toEqual([['billing']])
  })

  it('rend le slot de la section active et masque les autres', () => {
    const wrapper = render('billing', {
      'section-profile': () => 'Contenu profil',
      'section-billing': () => 'Contenu facturation',
    })
    const billing = wrapper.get('[data-section="billing"]')
    expect(billing.text()).toBe('Contenu facturation')
    expect(billing.element.parentElement?.getAttribute('style') ?? '').not.toContain(
      'display: none',
    )
    expect(
      wrapper.get('[data-section="profile"]').element.parentElement?.getAttribute('style'),
    ).toContain('display: none')
  })

  it('utilise le slot default en repli', () => {
    const wrapper = render('profile', { default: () => 'Repli' })
    expect(wrapper.get('[data-section="profile"]').text()).toBe('Repli')
  })

  it('la section danger a border-cp-danger', () => {
    const wrapper = render('danger')
    const danger = wrapper.get('[data-section="danger"]')
    expect(danger.classes()).toContain('border-cp-danger')
    expect(danger.attributes('data-danger')).toBeDefined()
    expect(wrapper.get('[data-section="profile"]').classes()).toContain('border-cp-line')
  })

  it('la nav est lg:w-56', () => {
    expect(render().get('nav').classes()).toContain('lg:w-56')
  })

  it('porte data-cp-layout-settings', () => {
    expect(render().find('[data-cp-layout-settings]').exists()).toBe(true)
  })
})
