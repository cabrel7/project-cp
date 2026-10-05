import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LayoutDashboard from '../../app/components/Cp/LayoutDashboard.vue'

const base = { title: 'Tableau de bord', description: 'Votre activité.' }

describe('CpLayoutDashboard', () => {
  it('rend le PageHeader et ses actions', () => {
    const wrapper = mount(LayoutDashboard, {
      props: base,
      slots: { actions: '<button data-action>Créer</button>' },
    })
    expect(wrapper.get('[data-cp-page-header] h1').text()).toBe('Tableau de bord')
    expect(wrapper.find('[data-cp-page-header] [data-action]').exists()).toBe(true)
  })

  it('stats dans une grille responsive 1/2/4 colonnes', () => {
    const wrapper = mount(LayoutDashboard, { props: base, slots: { stats: '<div data-stat />' } })
    const grid = wrapper.get('[data-stat]').element.parentElement as HTMLElement
    expect(grid.className).toContain('grid-cols-1')
    expect(grid.className).toContain('sm:grid-cols-2')
    expect(grid.className).toContain('lg:grid-cols-4')
  })

  it('charts dans une grille lg:grid-cols-2', () => {
    const wrapper = mount(LayoutDashboard, { props: base, slots: { charts: '<div data-chart />' } })
    const grid = wrapper.get('[data-chart]').element.parentElement as HTMLElement
    expect(grid.className).toContain('lg:grid-cols-2')
  })

  it('rend le slot credits', () => {
    const wrapper = mount(LayoutDashboard, {
      props: base,
      slots: { credits: '<div data-credits />' },
    })
    expect(wrapper.find('section [data-credits]').exists()).toBe(true)
  })

  it('la section todo a un aria-label', () => {
    const wrapper = mount(LayoutDashboard, { props: base, slots: { todo: '<div data-todo />' } })
    const section = wrapper.get('[data-todo]').element.parentElement as HTMLElement
    expect(section.tagName).toBe('SECTION')
    expect(section.getAttribute('aria-label')).toBe('Actions en attente')
  })

  it('n’affiche pas de section vide', () => {
    expect(mount(LayoutDashboard, { props: base }).findAll('section')).toHaveLength(0)
  })

  it('en loading, affiche 4 Skeleton tiles et masque les sections', () => {
    const wrapper = mount(LayoutDashboard, {
      props: { ...base, loading: true },
      slots: { stats: '<div data-stat />' },
    })
    expect(wrapper.findAll('[data-cp-skeleton][data-shape="tile"]')).toHaveLength(4)
    expect(wrapper.find('[data-stat]').exists()).toBe(false)
  })

  it('porte data-cp-layout-dashboard', () => {
    expect(
      mount(LayoutDashboard, { props: base }).attributes('data-cp-layout-dashboard'),
    ).toBeDefined()
  })
})
