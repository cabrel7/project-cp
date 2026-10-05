import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StatTile from '../../app/components/Cp/StatTile.vue'

const props = { label: 'Crédits restants', value: '12 430 cr' }

describe('CpStatTile', () => {
  it('affiche libellé et valeur avec les styles du design system', () => {
    const wrapper = mount(StatTile, { props })
    const [label, value] = wrapper.findAll('p')
    expect(label?.text()).toBe('Crédits restants')
    expect(label?.classes()).toEqual(expect.arrayContaining(['text-body-sm', 'text-cp-ink-muted']))
    expect(value?.text()).toBe('12 430 cr')
    expect(value?.classes()).toEqual(expect.arrayContaining(['text-kpi', 'tabular-nums']))
    expect(wrapper.classes()).toContain('bg-cp-surface')
  })

  it('accepte une valeur numérique', () => {
    expect(mount(StatTile, { props: { label: 'Runs', value: 42 } }).text()).toContain('42')
  })

  it('pas de variation sans trend', () => {
    expect(mount(StatTile, { props }).find('[data-cp-trend]').exists()).toBe(false)
  })

  it.each([
    ['up', 'i-lucide-trending-up', 'En hausse', 'text-cp-success'],
    ['down', 'i-lucide-trending-down', 'En baisse', 'text-cp-danger'],
    ['flat', 'i-lucide-minus', 'Stable', 'text-cp-ink-muted'],
  ] as const)('trend %s : icône %s, mot « %s », couleur %s', (trend, icon, word, color) => {
    const el = mount(StatTile, { props: { ...props, trend, trendValue: '+8 %' } }).get(
      '[data-cp-trend]',
    )
    expect(el.get('[data-icon]').attributes('data-icon')).toBe(icon)
    expect(el.text()).toContain(word)
    expect(el.text()).toContain('+8 %')
    expect(el.classes()).toContain(color)
  })

  it('invertTrend : une baisse est positive', () => {
    const el = mount(StatTile, { props: { ...props, trend: 'down', invertTrend: true } }).get(
      '[data-cp-trend]',
    )
    expect(el.classes()).toContain('text-cp-success')
  })

  it('chargement : squelette à la place du contenu', () => {
    const wrapper = mount(StatTile, { props: { ...props, trend: 'up', loading: true } })
    expect(wrapper.find('[data-cp-skeleton]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('12 430')
    expect(wrapper.find('[data-cp-trend]').exists()).toBe(false)
  })
})
