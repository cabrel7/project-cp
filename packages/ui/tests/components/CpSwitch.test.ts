import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Switch from '../../app/components/Cp/Switch.vue'

describe('CpSwitch', () => {
  it('affiche le libellé de l’état activé', () => {
    const wrapper = mount(Switch, {
      props: { modelValue: false, label: 'Demander mon accord avant d’envoyer' },
    })
    expect(wrapper.get('[data-label]').text()).toBe('Demander mon accord avant d’envoyer')
  })

  it('reflète le v-model dans aria-checked', () => {
    expect(
      mount(Switch, { props: { modelValue: true, label: 'x' } })
        .get('button')
        .attributes('aria-checked'),
    ).toBe('true')
    expect(
      mount(Switch, { props: { modelValue: false, label: 'x' } })
        .get('button')
        .attributes('aria-checked'),
    ).toBe('false')
  })

  it('émet la nouvelle valeur au clic', async () => {
    const wrapper = mount(Switch, { props: { modelValue: false, label: 'x' } })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })

  it('ne réagit pas quand il est désactivé', async () => {
    const wrapper = mount(Switch, { props: { modelValue: false, label: 'x', disabled: true } })
    expect(wrapper.get('button').element.disabled).toBe(true)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
