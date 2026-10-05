import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Select from '../../app/components/Cp/Select.vue'

const options = [
  { value: 'flash', label: 'Rapide' },
  { value: 'smart', label: 'Équilibré' },
  { value: 'max', label: 'Expert' },
]

describe('CpSelect', () => {
  it('affiche le libellé et toutes les options', () => {
    const wrapper = mount(Select, { props: { label: 'Profil', options } })
    expect(wrapper.get('[data-label]').text()).toBe('Profil')
    expect(wrapper.findAll('option').map((o) => o.text())).toEqual([
      'Rapide',
      'Équilibré',
      'Expert',
    ])
  })

  it('affiche l’aide sans erreur', () => {
    const wrapper = mount(Select, {
      props: { label: 'Profil', options, help: 'Vitesse et précision' },
    })
    expect(wrapper.get('[data-help]').text()).toBe('Vitesse et précision')
  })

  it('l’erreur remplace l’aide et s’affiche avec une icône', () => {
    const wrapper = mount(Select, {
      props: { label: 'Profil', options, help: 'Aide', error: 'Choisissez un profil' },
    })
    expect(wrapper.find('[data-help]').exists()).toBe(false)
    const error = wrapper.get('[data-error]')
    expect(error.text()).toBe('Choisissez un profil')
    expect(error.get('[data-icon]').attributes('data-icon')).toBe('i-lucide-circle-alert')
  })

  it('émet update:modelValue au changement', async () => {
    const wrapper = mount(Select, { props: { label: 'Profil', options, modelValue: 'flash' } })
    await wrapper.get('select').setValue('max')
    expect(wrapper.emitted('update:modelValue')).toEqual([['max']])
  })

  it('transmet placeholder et disabled', () => {
    const wrapper = mount(Select, {
      props: { label: 'Profil', options, placeholder: 'Choisir…', disabled: true },
    })
    expect(wrapper.get('select').attributes('data-placeholder')).toBe('Choisir…')
    expect(wrapper.get('select').element.disabled).toBe(true)
  })
})
