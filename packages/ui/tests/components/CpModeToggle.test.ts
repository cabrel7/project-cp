import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ModeToggle from '../../app/components/Cp/ModeToggle.vue'
import { mountWithMode } from '../mode'

describe('CpModeToggle', () => {
  it('propose Simple et Technique, Simple sélectionné par défaut', () => {
    const { wrapper } = mountWithMode(ModeToggle, {})
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios.map((r) => r.text())).toEqual(['Simple', 'Technique'])
    expect(radios[0]?.attributes('aria-checked')).toBe('true')
    expect(radios[1]?.attributes('aria-checked')).toBe('false')
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe("Mode d'affichage")
  })

  it('cliquer sur Technique bascule le mode partagé', async () => {
    const { wrapper, mode } = mountWithMode(ModeToggle, {})
    await wrapper.get('[data-value="technical"]').trigger('click')
    expect(mode.technicalMode.value).toBe(true)
    expect(wrapper.get('[data-value="technical"]').attributes('aria-checked')).toBe('true')
  })

  it('recliquer sur l option active ne change rien', async () => {
    const { wrapper, mode } = mountWithMode(ModeToggle, {}, { technical: true })
    await wrapper.get('[data-value="technical"]').trigger('click')
    expect(mode.technicalMode.value).toBe(true)
  })

  it('options personnalisées (période) : v-model, sans toucher au mode', async () => {
    const options = [
      { label: '7 j', value: '7' },
      { label: '30 j', value: '30' },
      { label: '90 j', value: '90' },
    ]
    const wrapper = mount(ModeToggle, {
      props: {
        options,
        modelValue: '7',
        label: 'Période',
        'onUpdate:modelValue': (value: string | undefined) =>
          wrapper.setProps({ modelValue: value }),
      },
    })
    expect(wrapper.findAll('[role="radio"]').map((r) => r.text())).toEqual(['7 j', '30 j', '90 j'])
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('Période')
    await wrapper.get('[data-value="90"]').trigger('click')
    expect(wrapper.get('[data-value="90"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.get('[data-value="7"]').attributes('aria-checked')).toBe('false')
  })
})
