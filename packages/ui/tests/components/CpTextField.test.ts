import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TextField from '../../app/components/Cp/TextField.vue'

describe('CpTextField', () => {
  it('affiche toujours le libellé', () => {
    const wrapper = mount(TextField, { props: { label: 'Adresse e-mail' } })
    expect(wrapper.get('[data-label]').text()).toBe('Adresse e-mail')
  })

  it('affiche l’aide quand il n’y a pas d’erreur', () => {
    const wrapper = mount(TextField, { props: { label: 'Nom', help: 'Visible par votre équipe' } })
    expect(wrapper.get('[data-help]').text()).toBe('Visible par votre équipe')
    expect(wrapper.find('[data-error]').exists()).toBe(false)
  })

  it('l’erreur remplace l’aide et s’affiche avec une icône', () => {
    const wrapper = mount(TextField, {
      props: { label: 'Nom', help: 'Visible par votre équipe', error: 'Ce champ est requis' },
    })
    expect(wrapper.find('[data-help]').exists()).toBe(false)
    const error = wrapper.get('[data-error]')
    expect(error.text()).toBe('Ce champ est requis')
    expect(error.get('[data-icon]').attributes('data-icon')).toBe('i-lucide-circle-alert')
    expect(error.get('span').classes()).toContain('text-cp-danger')
  })

  it('met à jour le v-model à la saisie', async () => {
    const wrapper = mount(TextField, {
      props: {
        label: 'Nom',
        modelValue: '',
        'onUpdate:modelValue': (value: string | number | undefined) =>
          wrapper.setProps({ modelValue: value }),
      },
    })
    await wrapper.get('input').setValue('Awa')
    expect(wrapper.emitted('update:modelValue')).toEqual([['Awa']])
    expect(wrapper.get('input').element.value).toBe('Awa')
  })

  it('transmet type, placeholder, disabled et required', () => {
    const wrapper = mount(TextField, {
      props: {
        label: 'Téléphone',
        type: 'tel',
        placeholder: '+225 07 00 00 00 00',
        disabled: true,
        required: true,
      },
    })
    const input = wrapper.get('input')
    expect(input.attributes('type')).toBe('tel')
    expect(input.attributes('placeholder')).toBe('+225 07 00 00 00 00')
    expect(input.element.disabled).toBe(true)
    expect(input.element.required).toBe(true)
  })

  it('utilise le type text par défaut', () => {
    const wrapper = mount(TextField, { props: { label: 'Nom' } })
    expect(wrapper.get('input').attributes('type')).toBe('text')
  })
})
