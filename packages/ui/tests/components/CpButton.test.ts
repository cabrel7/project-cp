import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Button from '../../app/components/Cp/Button.vue'

describe('CpButton', () => {
  it('rend un UButton avec le libellé reçu en attribut', () => {
    const wrapper = mount(Button, { attrs: { label: 'Connecter' } })
    const button = wrapper.get('button')
    expect(button.text()).toBe('Connecter')
    expect(button.attributes('data-color')).toBe('primary')
    expect(button.attributes('data-variant')).toBe('solid')
  })

  it('rend le contenu du slot par défaut', () => {
    const wrapper = mount(Button, { slots: { default: 'Créer un assistant' } })
    expect(wrapper.get('button').text()).toBe('Créer un assistant')
  })

  it.each([
    ['primary', 'primary', 'solid'],
    ['secondary', 'neutral', 'outline'],
    ['ghost', 'neutral', 'ghost'],
    ['danger', 'error', 'solid'],
  ] as const)('variante %s -> color %s / variant %s', (variant, color, uiVariant) => {
    const wrapper = mount(Button, { props: { variant }, attrs: { label: 'x' } })
    expect(wrapper.get('button').attributes('data-color')).toBe(color)
    expect(wrapper.get('button').attributes('data-variant')).toBe(uiVariant)
  })

  it('transmet taille, icône et attributs natifs à UButton', () => {
    const wrapper = mount(Button, {
      attrs: { label: 'x', size: 'lg', icon: 'i-lucide-plus', 'aria-label': 'Ajouter' },
    })
    const button = wrapper.get('button')
    expect(button.attributes('data-size')).toBe('lg')
    expect(button.attributes('data-icon')).toBe('i-lucide-plus')
    expect(button.attributes('aria-label')).toBe('Ajouter')
  })

  it('est désactivé quand disabled ou loading est fourni', () => {
    expect(
      mount(Button, { attrs: { label: 'x', disabled: true } }).get('button').element.disabled,
    ).toBe(true)
    expect(
      mount(Button, { attrs: { label: 'x', loading: true } }).get('button').element.disabled,
    ).toBe(true)
    expect(mount(Button, { attrs: { label: 'x' } }).get('button').element.disabled).toBe(false)
  })

  it('ne remplace pas le libellé quand aucun slot n’est fourni', () => {
    const wrapper = mount(Button, { attrs: { label: 'Libellé' } })
    expect(wrapper.text()).toContain('Libellé')
  })
})
