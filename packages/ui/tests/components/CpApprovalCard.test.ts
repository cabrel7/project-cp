import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ApprovalCard from '../../app/components/Cp/ApprovalCard.vue'
import { mountWithMode } from '../mode'

const NOW = new Date('2026-09-30T10:00:00.000Z')
const inMinutes = (n: number) => new Date(NOW.getTime() + n * 60_000).toISOString()

const props = {
  summary: 'L assistant veut envoyer 3 relances de paiement.',
  items: [
    { label: 'Client', value: 'Boutique Awa' },
    { label: 'Montant', value: '4 900 FCFA' },
  ],
  risk: 2 as const,
  parameters: { tool: 'send_reminder', count: 3 },
}

describe('CpApprovalCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('affiche titre, résumé, éléments et niveau de risque', () => {
    const { wrapper } = mountWithMode(ApprovalCard, props)
    expect(wrapper.get('h3').text()).toBe('À valider')
    expect(wrapper.get('[data-cp-summary]').text()).toBe(props.summary)
    expect(wrapper.findAll('[data-cp-item]').map((i) => i.text())).toEqual([
      'ClientBoutique Awa',
      'Montant4 900 FCFA',
    ])
    expect(wrapper.get('[data-level="medium"]').text()).toBe('Moyen')
  })

  it.each([
    [1, 'low'],
    [2, 'medium'],
    [3, 'high'],
    [4, 'critical'],
  ] as const)('risque %i => niveau %s', (risk, level) => {
    const { wrapper } = mountWithMode(ApprovalCard, { ...props, risk })
    expect(wrapper.find(`[data-level="${level}"]`).exists()).toBe(true)
  })

  it('trois actions avec les bonnes variantes', () => {
    const { wrapper } = mountWithMode(ApprovalCard, props)
    const approve = wrapper.get('[data-cp-action="approve"]')
    const modify = wrapper.get('[data-cp-action="modify"]')
    const reject = wrapper.get('[data-cp-action="reject"]')
    expect([approve.text(), modify.text(), reject.text()]).toEqual([
      'Approuver',
      'Modifier',
      'Refuser',
    ])
    expect(approve.attributes('data-color')).toBe('primary')
    expect(modify.attributes('data-variant')).toBe('outline')
    expect(reject.attributes('data-color')).toBe('error')
  })

  it('émet approve, modify et reject', async () => {
    const { wrapper } = mountWithMode(ApprovalCard, props)
    await wrapper.get('[data-cp-action="approve"]').trigger('click')
    await wrapper.get('[data-cp-action="modify"]').trigger('click')
    await wrapper.get('[data-cp-action="reject"]').trigger('click')
    const host = wrapper.findComponent(ApprovalCard)
    expect(host.emitted('approve')).toHaveLength(1)
    expect(host.emitted('modify')).toHaveLength(1)
    expect(host.emitted('reject')).toHaveLength(1)
  })

  it('Simple : pas de paramètres exacts', () => {
    const { wrapper } = mountWithMode(ApprovalCard, props)
    expect(wrapper.find('[data-cp-parameters]').exists()).toBe(false)
  })

  it('Technique : paramètres exacts en JSON, en plus du reste', () => {
    const { wrapper } = mountWithMode(ApprovalCard, props, { technical: true })
    const params = wrapper.get('[data-cp-parameters]')
    expect(params.text()).toContain('"tool": "send_reminder"')
    expect(wrapper.get('[data-cp-summary]').exists()).toBe(true)
  })

  it('Technique sans paramètres : rien à montrer', () => {
    const { wrapper } = mountWithMode(
      ApprovalCard,
      { ...props, parameters: undefined },
      { technical: true },
    )
    expect(wrapper.find('[data-cp-parameters]').exists()).toBe(false)
  })

  it.each([
    [45, 'Délai restant : 45 min'],
    [180, 'Délai restant : 3 h'],
    [60 * 24 * 3, 'Délai restant : 3 j'],
  ])('délai dans %i min => « %s »', (minutes, text) => {
    const { wrapper } = mountWithMode(ApprovalCard, { ...props, deadline: inMinutes(minutes) })
    expect(wrapper.get('[data-cp-deadline]').text()).toBe(text)
  })

  it('pas de ligne de délai sans échéance', () => {
    const { wrapper } = mountWithMode(ApprovalCard, props)
    expect(wrapper.find('[data-cp-deadline]').exists()).toBe(false)
  })

  it('délai dépassé : mot + icône, actions désactivées', () => {
    const { wrapper } = mountWithMode(ApprovalCard, { ...props, deadline: inMinutes(-5) })
    const deadline = wrapper.get('[data-cp-deadline]')
    expect(deadline.text()).toBe('Délai dépassé')
    expect(deadline.get('[data-icon="i-lucide-circle-alert"]').exists()).toBe(true)
    for (const action of ['approve', 'modify', 'reject']) {
      expect(wrapper.get(`[data-cp-action="${action}"]`).attributes('disabled')).toBeDefined()
    }
  })

  it('le délai se met à jour avec le temps', async () => {
    const { wrapper } = mountWithMode(ApprovalCard, { ...props, deadline: inMinutes(2) })
    expect(wrapper.get('[data-cp-deadline]').text()).toBe('Délai restant : 2 min')
    await vi.advanceTimersByTimeAsync(3 * 60_000)
    expect(wrapper.get('[data-cp-deadline]').text()).toBe('Délai dépassé')
  })

  it('chargement : boutons désactivés, carte occupée', () => {
    const { wrapper } = mountWithMode(ApprovalCard, { ...props, loading: true })
    expect(wrapper.get('[data-cp-approval-card]').attributes('aria-busy')).toBe('true')
    for (const action of ['approve', 'modify', 'reject']) {
      expect(wrapper.get(`[data-cp-action="${action}"]`).attributes('disabled')).toBeDefined()
    }
  })
})
