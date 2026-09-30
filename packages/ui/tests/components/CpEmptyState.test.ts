import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import EmptyState from '../../app/components/Cp/EmptyState.vue'

describe('CpEmptyState', () => {
  it('utilise les textes i18n par défaut sans titre ni description', () => {
    const wrapper = mount(EmptyState)
    expect(wrapper.get('h3').text()).toBe("Rien ici pour l'instant")
    expect(wrapper.get('p').text()).toBe('Commencez par créer votre premier élément.')
  })

  it('titre seul : pas de phrase par défaut', () => {
    const wrapper = mount(EmptyState, { props: { title: 'Aucun assistant' } })
    expect(wrapper.get('h3').text()).toBe('Aucun assistant')
    expect(wrapper.find('p').exists()).toBe(false)
  })

  it('affiche titre et description fournis', () => {
    const wrapper = mount(EmptyState, {
      props: {
        title: 'Aucun assistant',
        description: 'Créez-en un pour automatiser vos relances.',
      },
    })
    expect(wrapper.get('p').text()).toBe('Créez-en un pour automatiser vos relances.')
  })

  it('icône par défaut et icône personnalisée, masquée aux lecteurs d’écran', () => {
    expect(mount(EmptyState).get('[data-icon]').attributes('data-icon')).toBe('i-lucide-inbox')
    const icon = mount(EmptyState, { props: { icon: 'i-lucide-bot' } }).get('[data-icon]')
    expect(icon.attributes('data-icon')).toBe('i-lucide-bot')
    expect(icon.attributes('aria-hidden')).toBe('true')
  })

  it('pastille primary-soft', () => {
    const pill = mount(EmptyState).get('span')
    expect(pill.classes()).toEqual(
      expect.arrayContaining(['bg-cp-primary-soft', 'text-cp-primary']),
    )
  })

  it('pas de bouton sans action', () => {
    expect(mount(EmptyState).find('button').exists()).toBe(false)
  })

  it('bouton d’action : libellé et clic', async () => {
    const onClick = vi.fn()
    const wrapper = mount(EmptyState, {
      props: { action: { label: 'Créer un assistant', onClick } },
    })
    const button = wrapper.get('button')
    expect(button.text()).toBe('Créer un assistant')
    await button.trigger('click')
    expect(onClick).toHaveBeenCalledOnce()
  })
})
