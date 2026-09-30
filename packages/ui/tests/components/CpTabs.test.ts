import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Tabs from '../../app/components/Cp/Tabs.vue'

const items = [
  { label: 'Vue d’ensemble', value: 'overview' },
  { label: 'Configuration', value: 'config' },
  { label: 'Activité', value: 'activity', badge: 3 },
]

describe('CpTabs', () => {
  it('rend un onglet par item avec son compteur', () => {
    const wrapper = mount(Tabs, { props: { items, modelValue: 'overview' } })
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((t) => t.text())).toEqual(['Vue d’ensemble', 'Configuration', 'Activité3'])
    expect(wrapper.findAll('[data-badge]').map((b) => b.text())).toEqual(['3'])
  })

  it('marque l’onglet actif', () => {
    const wrapper = mount(Tabs, { props: { items, modelValue: 'config' } })
    const selected = wrapper.findAll('[role="tab"]').map((t) => t.attributes('aria-selected'))
    expect(selected).toEqual(['false', 'true', 'false'])
  })

  it('émet update:modelValue au clic sur un onglet', async () => {
    const wrapper = mount(Tabs, { props: { items, modelValue: 'overview' } })
    await wrapper.findAll('[role="tab"]')[2]?.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['activity']])
  })

  it('utilise le style souligné en primary', () => {
    const wrapper = mount(Tabs, { props: { items, modelValue: 'overview' } })
    expect(wrapper.get('[role="tablist"]').attributes('data-variant')).toBe('link')
    expect(wrapper.get('[role="tablist"]').attributes('data-color')).toBe('primary')
  })
})
