import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PageHeader from '../../app/components/Cp/PageHeader.vue'

describe('CpPageHeader', () => {
  it('affiche le titre en heading-1 (h1)', () => {
    const h1 = mount(PageHeader, { props: { title: 'Assistants' } }).get('h1')
    expect(h1.text()).toBe('Assistants')
    expect(h1.classes()).toContain('text-heading-1')
  })

  it('description en ink-muted, absente par défaut', () => {
    expect(
      mount(PageHeader, { props: { title: 'A' } })
        .find('p')
        .exists(),
    ).toBe(false)
    const p = mount(PageHeader, { props: { title: 'A', description: 'Vos assistants IA.' } }).get(
      'p',
    )
    expect(p.text()).toBe('Vos assistants IA.')
    expect(p.classes()).toContain('text-cp-ink-muted')
  })

  it('pas de fil d’Ariane sans breadcrumbs', () => {
    expect(
      mount(PageHeader, { props: { title: 'A' } })
        .find('nav')
        .exists(),
    ).toBe(false)
    expect(
      mount(PageHeader, { props: { title: 'A', breadcrumbs: [] } })
        .find('nav')
        .exists(),
    ).toBe(false)
  })

  it('fil d’Ariane : liens, page courante, libellé accessible', () => {
    const wrapper = mount(PageHeader, {
      props: {
        title: 'Relances',
        breadcrumbs: [{ label: 'Assistants', to: '/assistants' }, { label: 'Relances' }],
      },
    })
    expect(wrapper.get('nav').attributes('aria-label')).toBe("Fil d'Ariane")
    const link = wrapper.get('a')
    expect(link.text()).toBe('Assistants')
    expect(link.attributes('href')).toBe('/assistants')
    expect(wrapper.get('[aria-current="page"]').text()).toBe('Relances')
    expect(wrapper.findAll('[data-icon="i-lucide-chevron-right"]')).toHaveLength(1)
  })

  it('rend le slot actions', () => {
    const wrapper = mount(PageHeader, {
      props: { title: 'A' },
      slots: { actions: '<button data-action>Créer</button>' },
    })
    expect(wrapper.get('[data-cp-actions] [data-action]').text()).toBe('Créer')
  })

  it('pas de conteneur d’actions sans slot', () => {
    expect(
      mount(PageHeader, { props: { title: 'A' } })
        .find('[data-cp-actions]')
        .exists(),
    ).toBe(false)
  })
})
