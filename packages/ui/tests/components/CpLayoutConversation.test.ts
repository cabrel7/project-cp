import { describe, expect, it } from 'vitest'
import LayoutConversation from '../../app/components/Cp/LayoutConversation.vue'
import { mountWithMode } from '../mode'

const suggestions = [
  { label: 'Résumer mes ventes', value: 'sales' },
  { label: 'Relancer un client', value: 'followup' },
]

const render = (props: Record<string, unknown> = {}, slots: Record<string, () => unknown> = {}) =>
  mountWithMode(LayoutConversation, props, { slots }).wrapper

describe('CpLayoutConversation', () => {
  it('rend le titre dans le header si fourni', () => {
    const wrapper = render({ title: 'Discuter' })
    expect(wrapper.get('header h2').text()).toBe('Discuter')
  })

  it('pas de header sans titre ni slot', () => {
    expect(render().find('header').exists()).toBe(false)
  })

  it('rend les suggestions si showSuggestions', () => {
    const wrapper = render({ suggestions, showSuggestions: true })
    expect(wrapper.findAll('[data-cp-suggestion]').map((b) => b.text())).toEqual([
      'Résumer mes ventes',
      'Relancer un client',
    ])
    expect(render({ suggestions }).findAll('[data-cp-suggestion]')).toHaveLength(0)
  })

  it('le clic sur une suggestion émet suggest avec la valeur', async () => {
    const wrapper = render({ suggestions, showSuggestions: true })
    await wrapper.findAll('[data-cp-suggestion]')[1]?.trigger('click')
    expect(wrapper.findComponent(LayoutConversation).emitted('suggest')).toEqual([['followup']])
  })

  it('rend le slot default dans la zone scrollable', () => {
    const wrapper = render({}, { default: () => 'Bonjour' })
    expect(wrapper.get('[data-cp-messages]').classes()).toContain('overflow-y-auto')
    expect(wrapper.get('[data-cp-messages]').text()).toContain('Bonjour')
  })

  it('le submit émet send quand la saisie est renseignée', async () => {
    const wrapper = render({ input: 'Salut' })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.findComponent(LayoutConversation).emitted('send')).toHaveLength(1)
  })

  it('le submit n’émet rien si la saisie est vide', async () => {
    const wrapper = render({ input: '   ' })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.findComponent(LayoutConversation).emitted('send')).toBeUndefined()
  })

  it('désactive la saisie si inputDisabled', async () => {
    const wrapper = render({ input: 'Salut', inputDisabled: true })
    expect(wrapper.get('textarea').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.findComponent(LayoutConversation).emitted('send')).toBeUndefined()
  })

  it('désactive le bouton envoyer si la saisie est vide', () => {
    expect(render({ input: '' }).get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(
      render({ input: 'Salut' }).get('button[type="submit"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('porte data-cp-layout-conversation', () => {
    expect(render().find('[data-cp-layout-conversation]').exists()).toBe(true)
  })
})
