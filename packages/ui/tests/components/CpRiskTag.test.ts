import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import RiskTag, { type CpRiskLevel } from '../../app/components/Cp/RiskTag.vue'
import en from '../../i18n/locales/en.json'
import { t } from '../i18n'

const CASES: [CpRiskLevel, number, string, string][] = [
  ['low', 1, 'text-cp-success', 'Faible'],
  ['medium', 2, 'text-cp-warning', 'Moyen'],
  ['high', 3, 'text-cp-danger', 'Élevé'],
  ['critical', 4, 'text-cp-danger', 'Critique'],
]

describe('CpRiskTag', () => {
  beforeEach(() => {
    t.mockClear()
  })

  it.each(CASES)('%s -> %i barre(s), %s, mot « %s »', (level, bars, color, word) => {
    const wrapper = mount(RiskTag, { props: { level } })
    const all = wrapper.findAll('[data-cp-bar]')
    expect(all).toHaveLength(4)
    expect(all.filter((b) => b.attributes('data-filled') === 'true')).toHaveLength(bars)
    // les barres pleines sont les premières
    expect(all.slice(0, bars).every((b) => b.classes().includes('bg-current'))).toBe(true)
    expect(all.slice(bars).every((b) => b.classes().includes('bg-cp-line-strong'))).toBe(true)
    expect(wrapper.classes()).toContain(color)
    expect(wrapper.text()).toBe(word)
    expect(t).toHaveBeenCalledWith(`cp.risk.${level}`)
  })

  it('met le niveau critique en gras, pas les autres', () => {
    expect(mount(RiskTag, { props: { level: 'critical' } }).classes()).toContain('font-bold')
    for (const level of ['low', 'medium', 'high'] as const) {
      expect(mount(RiskTag, { props: { level } }).classes()).not.toContain('font-bold')
    }
  })

  it('cache les barres aux lecteurs d’écran (le mot porte le sens)', () => {
    const wrapper = mount(RiskTag, { props: { level: 'high' } })
    expect(wrapper.get('[data-cp-bar]').element.parentElement?.getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  it('a une traduction anglaise pour chaque niveau', () => {
    for (const [level] of CASES) expect(en.cp.risk[level]).toBeTruthy()
  })
})
