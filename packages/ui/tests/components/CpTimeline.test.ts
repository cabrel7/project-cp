import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Timeline, { type CpTimelineItem } from '../../app/components/Cp/Timeline.vue'

const items: CpTimelineItem[] = [
  { title: 'Demande reçue', time: '10:02', variant: 'success' },
  { title: 'Analyse', description: 'Lecture du devis', time: '10:03' },
  { title: 'Validation requise', time: '10:04', variant: 'warning', icon: 'i-lucide-shield-check' },
  { title: 'Échec de l’envoi', time: '10:05', variant: 'danger' },
]

describe('CpTimeline', () => {
  it('rend une entrée par élément dans une liste ordonnée', () => {
    const wrapper = mount(Timeline, { props: { items } })
    expect(wrapper.find('ol').exists()).toBe(true)
    expect(wrapper.findAll('li')).toHaveLength(4)
  })

  it('affiche titre, description et heure', () => {
    const second = mount(Timeline, { props: { items } }).findAll('li')[1]
    expect(second?.text()).toContain('Analyse')
    expect(second?.text()).toContain('Lecture du devis')
    expect(second?.text()).toContain('10:03')
  })

  it('pas de description : pas de paragraphe superflu', () => {
    const first = mount(Timeline, { props: { items } }).findAll('li')[0]
    expect(first?.findAll('p')).toHaveLength(1)
  })

  it.each([
    [0, 'success', 'bg-cp-success-soft', 'i-lucide-circle-check'],
    [1, 'default', 'bg-cp-surface-sunken', 'i-lucide-circle'],
    [2, 'warning', 'bg-cp-warning-soft', 'i-lucide-shield-check'],
    [3, 'danger', 'bg-cp-danger-soft', 'i-lucide-circle-alert'],
  ] as const)('élément %s : variante %s, pastille %s, icône %s', (index, variant, bg, icon) => {
    const li = mount(Timeline, { props: { items } }).findAll('li')[index]
    expect(li?.attributes('data-variant')).toBe(variant)
    expect(li?.find(`.${bg}`).exists()).toBe(true)
    expect(li?.get('[data-icon]').attributes('data-icon')).toBe(icon)
  })

  it('ligne de liaison entre les éléments, pas après le dernier', () => {
    const wrapper = mount(Timeline, { props: { items } })
    expect(wrapper.findAll('[data-cp-line]')).toHaveLength(3)
    expect(wrapper.findAll('li')[3]?.find('[data-cp-line]').exists()).toBe(false)
  })

  it('liste vide : aucune entrée', () => {
    expect(mount(Timeline, { props: { items: [] } }).findAll('li')).toHaveLength(0)
  })
})
