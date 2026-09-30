import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import ChatMessage from '../../app/components/Cp/ChatMessage.vue'
import { mountWithMode } from '../mode'

const toolCalls = [
  { name: 'orders.list', label: 'A consulté les commandes' },
  { name: 'customers.get', label: 'A consulté la fiche client' },
]

describe('CpChatMessage', () => {
  it('utilisateur : bulle primary à droite, sans pastille IA', () => {
    const { wrapper } = mountWithMode(ChatMessage, { author: 'user', content: 'Bonjour' })
    expect(wrapper.get('[data-cp-chat-message]').classes()).toContain('justify-end')
    const bubble = wrapper.get('[data-cp-bubble]')
    expect(bubble.text()).toBe('Bonjour')
    expect(bubble.classes()).toEqual(
      expect.arrayContaining(['bg-cp-primary', 'text-cp-on-primary']),
    )
    expect(wrapper.find('[data-cp-ai-badge]').exists()).toBe(false)
  })

  it('IA : bulle surface à gauche avec pastille IA accessible', () => {
    const { wrapper } = mountWithMode(ChatMessage, { author: 'ai', content: 'Voici le résultat' })
    expect(wrapper.get('[data-cp-chat-message]').classes()).toContain('justify-start')
    expect(wrapper.get('[data-cp-bubble]').classes()).toContain('bg-cp-surface')
    expect(wrapper.get('[data-cp-ai-badge]').attributes('aria-label')).toBe('Assistant IA')
  })

  it('body-lg en Simple, body en Technique', () => {
    const simple = mountWithMode(ChatMessage, { author: 'ai', content: 'x' })
    expect(simple.wrapper.get('[data-cp-bubble]').classes()).toContain('text-body-lg')
    const technical = mountWithMode(
      ChatMessage,
      { author: 'ai', content: 'x' },
      { technical: true },
    )
    expect(technical.wrapper.get('[data-cp-bubble]').classes()).toContain('text-body')
  })

  it('mention « Généré par l IA » seulement si demandée, sur une réponse IA', () => {
    const shown = mountWithMode(ChatMessage, { author: 'ai', content: 'x', showDisclaimer: true })
    expect(shown.wrapper.get('[data-cp-disclaimer]').text()).toBe(
      "Généré par l'IA — vérifiez les informations importantes",
    )
    expect(
      mountWithMode(ChatMessage, { author: 'ai', content: 'x' })
        .wrapper.find('[data-cp-disclaimer]')
        .exists(),
    ).toBe(false)
    expect(
      mountWithMode(ChatMessage, { author: 'user', content: 'x', showDisclaimer: true })
        .wrapper.find('[data-cp-disclaimer]')
        .exists(),
    ).toBe(false)
  })

  it('outils consultés : puce repliée, dépliable, libellé en clair', async () => {
    const { wrapper } = mountWithMode(ChatMessage, { author: 'ai', content: 'x', toolCalls })
    const toggle = wrapper.get('[data-cp-tool-toggle]')
    expect(toggle.text()).toContain('Sources consultées (2)')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-cp-tool-list]').exists()).toBe(false)
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('[data-cp-tool-call]').map((c) => c.text())).toEqual([
      'A consulté les commandes',
      'A consulté la fiche client',
    ])
  })

  it('Technique : le nom exact de l outil s ajoute au libellé', async () => {
    const { wrapper } = mountWithMode(
      ChatMessage,
      { author: 'ai', content: 'x', toolCalls },
      { technical: true },
    )
    await wrapper.get('[data-cp-tool-toggle]').trigger('click')
    expect(wrapper.findAll('[data-cp-tool-call]')[0]?.text()).toContain('orders.list')
  })

  it('pas d outils pour un message utilisateur', () => {
    const { wrapper } = mountWithMode(ChatMessage, { author: 'user', content: 'x', toolCalls })
    expect(wrapper.find('[data-cp-tool-toggle]').exists()).toBe(false)
  })

  it('en cours d écriture : indicateur annoncé, pas de mention IA', () => {
    const { wrapper } = mountWithMode(ChatMessage, {
      author: 'ai',
      loading: true,
      showDisclaimer: true,
    })
    const typing = wrapper.get('[data-cp-typing]')
    expect(typing.attributes('role')).toBe('status')
    expect(typing.text()).toBe("L'assistant écrit…")
    expect(wrapper.find('[data-cp-disclaimer]').exists()).toBe(false)
  })

  it('erreur : message annoncé avec icône, sans bulle ni mention IA', () => {
    const { wrapper } = mountWithMode(ChatMessage, {
      author: 'ai',
      content: 'ignoré',
      error: 'Connexion perdue. Réessayez.',
      showDisclaimer: true,
    })
    const error = wrapper.get('[data-cp-error]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toBe('Connexion perdue. Réessayez.')
    expect(error.find('[data-icon="i-lucide-circle-alert"]').exists()).toBe(true)
    expect(wrapper.find('[data-cp-bubble]').exists()).toBe(false)
    expect(wrapper.find('[data-cp-disclaimer]').exists()).toBe(false)
  })

  it('le slot par défaut accueille une carte d approbation', () => {
    const { wrapper } = mountWithMode(
      ChatMessage,
      { author: 'ai', content: 'Je propose ceci' },
      { slots: { default: () => h('div', { 'data-approval': '' }, 'carte') } },
    )
    expect(wrapper.get('[data-cp-slot] [data-approval]').text()).toBe('carte')
  })
})
