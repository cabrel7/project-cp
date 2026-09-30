import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PlanGate from '../../app/components/Cp/PlanGate.vue'

const props = {
  feature: 'Agents conversationnels',
  benefit: 'Répondez à vos clients 24 h sur 24 sans effort.',
  planName: 'Pro',
}

describe('CpPlanGate', () => {
  it('montre la fonction, son bénéfice et le plan qui l inclut', () => {
    const wrapper = mount(PlanGate, { props })
    expect(wrapper.get('[data-cp-feature]').text()).toBe(props.feature)
    expect(wrapper.get('[data-cp-benefit]').text()).toBe(props.benefit)
    expect(wrapper.get('[data-cp-locked]').text()).toBe('Inclus dans le plan Pro')
  })

  it('fond primary-soft et icône cadenas', () => {
    const wrapper = mount(PlanGate, { props })
    expect(wrapper.classes()).toContain('bg-cp-primary-soft')
    expect(wrapper.get('[data-icon="i-lucide-lock"]').exists()).toBe(true)
  })

  it('émet view-plans au clic sur « Voir les plans »', async () => {
    const wrapper = mount(PlanGate, { props })
    const button = wrapper.get('button')
    expect(button.text()).toBe('Voir les plans')
    await button.trigger('click')
    expect(wrapper.emitted('view-plans')).toHaveLength(1)
  })
})
