import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CreditMeter from '../../app/components/Cp/CreditMeter.vue'

const bar = (used: number, total: number) => {
  const wrapper = mount(CreditMeter, { props: { used, total } })
  return { wrapper, bar: wrapper.get('[data-cp-bar]') }
}

describe('CpCreditMeter', () => {
  it('expose une barre de progression accessible', () => {
    const { wrapper } = bar(50, 200)
    const meter = wrapper.get('[role="progressbar"]')
    expect(meter.attributes('aria-valuemin')).toBe('0')
    expect(meter.attributes('aria-valuemax')).toBe('100')
    expect(meter.attributes('aria-valuenow')).toBe('25')
    expect(meter.attributes('aria-valuetext')).toContain('25 %')
  })

  it('affiche le libellé, le pourcentage et les montants écrits', () => {
    const wrapper = mount(CreditMeter, { props: { used: 50, total: 200, label: 'Budget mensuel' } })
    expect(wrapper.text()).toContain('Budget mensuel')
    expect(wrapper.text()).toContain('25 %')
    expect(wrapper.text()).toMatch(/50 \/ 200 crédits/)
    expect(wrapper.get('[role="progressbar"]').attributes('aria-label')).toBe('Budget mensuel')
  })

  it('largeur de la barre = pourcentage', () => {
    expect(bar(50, 200).bar.attributes('style')).toContain('width: 25%')
  })

  it.each([
    [0, 'bg-cp-primary', 'ok'],
    [70, 'bg-cp-primary', 'ok'],
    [71, 'bg-cp-warning', 'warning'],
    [99, 'bg-cp-warning', 'warning'],
    [100, 'bg-cp-danger', 'danger'],
  ] as const)('%s %% -> %s (niveau %s)', (used, cls, level) => {
    const { wrapper, bar: el } = bar(used, 100)
    expect(el.classes()).toContain(cls)
    expect(wrapper.attributes('data-level')).toBe(level)
  })

  it('dépassement : plafonné à 100 %, épuisé avec icône et mot', () => {
    const { wrapper, bar: el } = bar(150, 100)
    expect(el.attributes('style')).toContain('width: 100%')
    expect(wrapper.get('[data-cp-exhausted]').text()).toBe('Crédits épuisés')
    expect(wrapper.find('[data-icon="i-lucide-circle-alert"]').exists()).toBe(true)
  })

  it("99,6 % ne s'arrondit jamais à 100 % ni à « épuisé »", () => {
    const { wrapper } = bar(996, 1000)
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('99')
    expect(wrapper.find('[data-cp-exhausted]').exists()).toBe(false)
  })

  it('pas de message « épuisé » sous 100 %', () => {
    expect(bar(99, 100).wrapper.find('[data-cp-exhausted]').exists()).toBe(false)
  })

  it('total à 0 : pas de division par zéro, considéré épuisé', () => {
    const { wrapper } = bar(0, 0)
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
    expect(wrapper.find('[data-cp-exhausted]').exists()).toBe(true)
  })

  it('valeur négative : plafonnée à 0 %', () => {
    expect(bar(-5, 100).wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
  })

  it('montants en chiffres tabulaires', () => {
    expect(bar(1, 2).wrapper.find('.tabular-nums').exists()).toBe(true)
  })
})
