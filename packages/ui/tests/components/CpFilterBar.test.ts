import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FilterBar from '../../app/components/Cp/FilterBar.vue'

describe('CpFilterBar', () => {
  it('expose une région de recherche avec placeholder i18n par défaut', () => {
    const wrapper = mount(FilterBar, { props: { modelValue: '' } })
    expect(wrapper.attributes('role')).toBe('search')
    const input = wrapper.get('input')
    expect(input.attributes('placeholder')).toBe('Rechercher…')
    expect(input.attributes('aria-label')).toBe('Rechercher…')
  })

  it('utilise le placeholder fourni', () => {
    const wrapper = mount(FilterBar, {
      props: { modelValue: '', searchPlaceholder: 'Rechercher un assistant' },
    })
    expect(wrapper.get('input').attributes('placeholder')).toBe('Rechercher un assistant')
  })

  it('reflète la valeur et émet update:modelValue à la saisie', async () => {
    const wrapper = mount(FilterBar, { props: { modelValue: 'rel' } })
    expect(wrapper.get('input').element.value).toBe('rel')
    await wrapper.get('input').setValue('relances')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['relances'])
  })

  it('rend les filtres du slot', () => {
    const wrapper = mount(FilterBar, {
      props: { modelValue: '' },
      slots: { default: '<button data-filter>Statut</button>' },
    })
    expect(wrapper.find('[data-filter]').exists()).toBe(true)
  })

  it('sans filtre actif ni recherche : pas de bouton Effacer', () => {
    const wrapper = mount(FilterBar, { props: { modelValue: '', activeCount: 0 } })
    expect(wrapper.find('[data-cp-clear]').exists()).toBe(false)
  })

  it('filtres actifs : bouton Effacer qui émet clear et vide la recherche', async () => {
    const wrapper = mount(FilterBar, { props: { modelValue: 'rel', activeCount: 2 } })
    const clear = wrapper.get('[data-cp-clear]')
    expect(clear.text()).toBe('Effacer les filtres')
    await clear.trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([''])
  })

  it('recherche non vide : bouton Effacer visible', () => {
    const wrapper = mount(FilterBar, { props: { modelValue: 'abc' } })
    expect(wrapper.find('[data-cp-clear]').exists()).toBe(true)
  })
})
