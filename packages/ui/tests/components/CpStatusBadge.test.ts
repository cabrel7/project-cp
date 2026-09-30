import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import StatusBadge, { type CpStatus } from '../../app/components/Cp/StatusBadge.vue'
import en from '../../i18n/locales/en.json'
import fr from '../../i18n/locales/fr.json'
import { t } from '../i18n'

const CASES: [CpStatus, string, string, string][] = [
  ['active', 'success', 'bg-cp-success', 'Actif'],
  ['online', 'success', 'bg-cp-success', 'En ligne'],
  ['success', 'success', 'bg-cp-success', 'Réussi'],
  ['paused', 'warning', 'bg-cp-warning', 'En pause'],
  ['warning', 'warning', 'bg-cp-warning', 'Attention'],
  ['pending', 'warning', 'bg-cp-warning', 'À valider'],
  ['error', 'danger', 'bg-cp-danger', 'Erreur'],
  ['failed', 'danger', 'bg-cp-danger', 'Échec'],
  ['revoked', 'danger', 'bg-cp-danger', 'Révoqué'],
  ['draft', 'neutral', 'bg-cp-ink-muted', 'Brouillon'],
  ['archived', 'neutral', 'bg-cp-ink-muted', 'Archivé'],
  ['running', 'info', 'bg-cp-info', 'En cours'],
  ['validating', 'info', 'bg-cp-info', 'En validation'],
]

describe('CpStatusBadge', () => {
  beforeEach(() => {
    t.mockClear()
  })

  it.each(CASES)('%s -> variante %s, point %s, mot « %s »', (status, variant, dot, word) => {
    const wrapper = mount(StatusBadge, { props: { status } })
    expect(wrapper.attributes('data-variant')).toBe(variant)
    const [dotEl, textEl] = wrapper.findAll('span > span')
    expect(dotEl?.classes()).toContain(dot)
    expect(dotEl?.attributes('aria-hidden')).toBe('true')
    expect(textEl?.text()).toBe(word)
    expect(textEl?.classes()).toContain('text-cp-ink')
    expect(t).toHaveBeenCalledWith(`cp.status.${status}`)
  })

  it('couvre les 13 statuts, tous traduits en FR et EN', () => {
    expect(CASES).toHaveLength(13)
    for (const [status] of CASES) {
      expect(fr.cp.status[status], `fr ${status}`).toBeTruthy()
      expect(en.cp.status[status], `en ${status}`).toBeTruthy()
    }
  })

  it('n’utilise aucune couleur en dur', () => {
    const wrapper = mount(StatusBadge, { props: { status: 'active' } })
    expect(wrapper.html()).not.toMatch(/#[0-9a-f]{3,8}\b|rgb|hsl|style=/i)
  })
})
