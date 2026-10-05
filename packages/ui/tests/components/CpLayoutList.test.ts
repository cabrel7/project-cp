import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LayoutList from '../../app/components/Cp/LayoutList.vue'

const base = { title: 'Assistants', description: 'Vos assistants IA.' }

describe('CpLayoutList', () => {
  it('rend le PageHeader avec titre et description', () => {
    const wrapper = mount(LayoutList, { props: base })
    expect(wrapper.get('[data-cp-page-header] h1').text()).toBe('Assistants')
    expect(wrapper.get('[data-cp-page-header] p').text()).toBe('Vos assistants IA.')
  })

  it('passe le slot actions au PageHeader', () => {
    const wrapper = mount(LayoutList, {
      props: base,
      slots: { actions: '<button data-action>Créer</button>' },
    })
    expect(wrapper.get('[data-cp-page-header] [data-action]').text()).toBe('Créer')
  })

  it('rend la barre de filtres avec ses filtres et la recherche', async () => {
    const wrapper = mount(LayoutList, {
      props: {
        ...base,
        search: 'a',
        'onUpdate:search': (v: string) => wrapper.setProps({ search: v }),
      },
      slots: { filters: '<span data-filter>Statut</span>' },
    })
    expect(wrapper.get('[data-cp-filter-bar] [data-filter]').text()).toBe('Statut')
    await wrapper.get('input').setValue('relances')
    expect(wrapper.emitted('update:search')?.[0]).toEqual(['relances'])
  })

  it('émet clear-filters', async () => {
    const wrapper = mount(LayoutList, { props: { ...base, activeFilterCount: 2 } })
    await wrapper.get('[data-cp-clear]').trigger('click')
    expect(wrapper.emitted('clear-filters')).toHaveLength(1)
  })

  it('en loading, affiche Skeleton et masque le contenu', () => {
    const wrapper = mount(LayoutList, {
      props: { ...base, loading: true },
      slots: { default: '<table data-table />' },
    })
    expect(wrapper.find('[data-cp-skeleton]').exists()).toBe(true)
    expect(wrapper.find('[data-table]').exists()).toBe(false)
  })

  it('le slot mobile-cards a la classe md:hidden', () => {
    const wrapper = mount(LayoutList, {
      props: base,
      slots: { 'mobile-cards': '<div data-cards />' },
    })
    expect(wrapper.get('[data-cp-layout-list-mobile]').classes()).toContain('md:hidden')
    expect(wrapper.find('[data-cards]').exists()).toBe(true)
  })

  it('le slot default a hidden md:block quand mobile-cards est fourni', () => {
    const wrapper = mount(LayoutList, {
      props: base,
      slots: { default: '<table data-table />', 'mobile-cards': '<div data-cards />' },
    })
    const main = wrapper.get('[data-cp-layout-list-main]')
    expect(main.classes()).toEqual(expect.arrayContaining(['hidden', 'md:block']))
    expect(main.find('[data-table]').exists()).toBe(true)
  })

  it('sans mobile-cards : pas de masquage ni de bloc mobile', () => {
    const wrapper = mount(LayoutList, { props: base, slots: { default: '<table data-table />' } })
    expect(wrapper.get('[data-cp-layout-list-main]').classes()).not.toContain('hidden')
    expect(wrapper.find('[data-cp-layout-list-mobile]').exists()).toBe(false)
  })

  it('rend le slot empty', () => {
    const wrapper = mount(LayoutList, { props: base, slots: { empty: '<p data-empty>Rien</p>' } })
    expect(wrapper.find('[data-empty]').exists()).toBe(true)
  })

  it('porte data-cp-layout-list sur la racine', () => {
    expect(mount(LayoutList, { props: base }).attributes('data-cp-layout-list')).toBeDefined()
  })
})
