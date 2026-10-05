import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Stepper from '../../app/components/Cp/Stepper.vue'

const steps = [
  { label: 'Connecter', description: 'Votre boutique' },
  { label: 'Choisir les actions' },
  { label: 'Tester' },
  { label: 'Publier' },
]

const states = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('li').map((li) => li.attributes('data-state'))

describe('CpStepper', () => {
  it('rend une étape par entrée dans une liste ordonnée', () => {
    const wrapper = mount(Stepper, { props: { steps, currentStep: 0 } })
    expect(wrapper.find('ol').exists()).toBe(true)
    expect(wrapper.findAll('li')).toHaveLength(4)
    expect(wrapper.text()).toContain('Votre boutique')
  })

  it('états : terminées, courante, à venir', () => {
    expect(states(mount(Stepper, { props: { steps, currentStep: 2 } }))).toEqual([
      'done',
      'done',
      'current',
      'todo',
    ])
  })

  it('étape courante : primary et aria-current=step, une seule', () => {
    const wrapper = mount(Stepper, { props: { steps, currentStep: 1 } })
    const current = wrapper.findAll('[aria-current="step"]')
    expect(current).toHaveLength(1)
    expect(current[0]?.text()).toContain('Choisir les actions')
    expect(current[0]?.find('.bg-cp-primary').exists()).toBe(true)
    expect(current[0]?.find('.text-cp-primary').exists()).toBe(true)
  })

  it('terminée : coche success et mot « Terminée »', () => {
    const done = mount(Stepper, { props: { steps, currentStep: 1 } }).findAll('li')[0]
    expect(done?.find('.bg-cp-success').exists()).toBe(true)
    expect(done?.find('[data-icon="i-lucide-check"]').exists()).toBe(true)
    expect(done?.text()).toContain('Terminée')
  })

  it('à venir : ink-muted avec numéro', () => {
    const todo = mount(Stepper, { props: { steps, currentStep: 0 } }).findAll('li')[3]
    expect(todo?.find('.text-cp-ink-muted').exists()).toBe(true)
    expect(todo?.text()).toContain('4')
    expect(todo?.find('[data-icon]').exists()).toBe(false)
  })

  it('résumé mobile « Étape 2 sur 4 — … »', () => {
    const summary = mount(Stepper, { props: { steps, currentStep: 1 } }).get(
      '[data-cp-stepper-summary]',
    )
    expect(summary.text()).toBe('Étape 2 sur 4 — Choisir les actions')
    expect(summary.classes()).toContain('sm:hidden')
  })

  it('résumé vide si currentStep hors bornes', () => {
    const wrapper = mount(Stepper, { props: { steps, currentStep: 9 } })
    expect(wrapper.get('[data-cp-stepper-summary]').text()).toBe('')
    expect(states(wrapper)).toEqual(['done', 'done', 'done', 'done'])
  })

  it('orientation horizontale par défaut, verticale en option', () => {
    expect(
      mount(Stepper, { props: { steps, currentStep: 0 } }).attributes('data-orientation'),
    ).toBe('horizontal')
    const vertical = mount(Stepper, { props: { steps, currentStep: 0, orientation: 'vertical' } })
    expect(vertical.attributes('data-orientation')).toBe('vertical')
    expect(vertical.get('ol').classes()).toContain('flex-col')
  })
})
