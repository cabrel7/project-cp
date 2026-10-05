import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LayoutDetail from '../../app/components/Cp/LayoutDetail.vue'

const breadcrumbs = [{ label: 'Assistants', to: '/assistants' }, { label: 'Relances' }]
const base = { title: 'Relances', breadcrumbs }

describe('CpLayoutDetail', () => {
  it('rend le PageHeader avec titre et breadcrumbs', () => {
    const wrapper = mount(LayoutDetail, { props: base })
    expect(wrapper.get('[data-cp-page-header] h1').text()).toBe('Relances')
    expect(wrapper.get('[data-cp-page-header] nav a').text()).toBe('Assistants')
  })

  it('place status et actions dans les actions du header', () => {
    const wrapper = mount(LayoutDetail, {
      props: base,
      slots: {
        status: '<span data-status>Actif</span>',
        actions: '<button data-action>Pause</button>',
      },
    })
    const actions = wrapper.get('[data-cp-actions]')
    expect(actions.find('[data-status]').exists()).toBe(true)
    expect(actions.find('[data-action]').exists()).toBe(true)
  })

  it('rend le slot aside dans un <aside>', () => {
    const wrapper = mount(LayoutDetail, {
      props: base,
      slots: { aside: '<p data-meta>Créé le…</p>' },
    })
    expect(wrapper.get('aside [data-meta]').exists()).toBe(true)
  })

  it('pas de <aside> sans slot', () => {
    expect(mount(LayoutDetail, { props: base }).find('aside').exists()).toBe(false)
  })

  it('la grille a xl:grid-cols-[1fr_320px]', () => {
    const wrapper = mount(LayoutDetail, { props: base })
    expect(wrapper.get('[data-cp-layout-detail-grid]').classes()).toContain(
      'xl:grid-cols-[1fr_320px]',
    )
  })

  it('onglets : premier actif par défaut, émet update:tab', async () => {
    const tabs = [
      { label: 'Aperçu', value: 'overview' },
      { label: 'Activité', value: 'activity' },
    ]
    const wrapper = mount(LayoutDetail, { props: { ...base, tabs } })
    const buttons = wrapper.findAll('[role="tab"]')
    expect(buttons[0]?.attributes('aria-selected')).toBe('true')
    await buttons[1]?.trigger('click')
    expect(wrapper.emitted('update:tab')?.[0]).toEqual(['activity'])
  })

  it('rend les stats', () => {
    const wrapper = mount(LayoutDetail, { props: base, slots: { stats: '<div data-stat />' } })
    expect(wrapper.find('[data-stat]').exists()).toBe(true)
  })

  it('en loading, affiche Skeleton à la place du contenu', () => {
    const wrapper = mount(LayoutDetail, {
      props: { ...base, loading: true },
      slots: { default: '<p data-content />' },
    })
    expect(wrapper.find('[data-cp-skeleton]').exists()).toBe(true)
    expect(wrapper.find('[data-content]').exists()).toBe(false)
  })

  it('rend le contenu hors loading', () => {
    const wrapper = mount(LayoutDetail, { props: base, slots: { default: '<p data-content />' } })
    expect(wrapper.find('[data-content]').exists()).toBe(true)
  })

  it('porte data-cp-layout-detail', () => {
    expect(mount(LayoutDetail, { props: base }).attributes('data-cp-layout-detail')).toBeDefined()
  })
})
