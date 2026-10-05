import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { type ComputedRef, defineComponent, h, ref } from 'vue'
import type { CpNavItem } from '../../app/components/Cp/SidebarNav.vue'
import { useClientNav } from '../../app/composables/useClientNav'
import { mountWithMode } from '../mode'

const mounted: VueWrapper[] = []

/** Appelle le composable dans un composant minimal, sous un fournisseur de mode. */
function setup(
  options: { technical?: boolean; pendingApprovals?: Parameters<typeof useClientNav>[0] } = {},
) {
  let nav: ComputedRef<CpNavItem[]> | undefined
  const Probe = defineComponent({
    setup() {
      nav = useClientNav(options.pendingApprovals)
      return () => h('div')
    },
  })
  const { wrapper, mode } = mountWithMode(Probe, {}, { technical: options.technical })
  mounted.push(wrapper)
  return { nav: nav as ComputedRef<CpNavItem[]>, mode }
}

const labelOf = (nav: ComputedRef<CpNavItem[]>, value: string) =>
  nav.value.find((i) => i.value === value)?.label

const EXPECTED_ORDER = [
  'home',
  'chat',
  'approvals',
  'mcp-servers',
  'connectors',
  'agents',
  'capabilities',
  'marketplace',
  'activity',
  'usage',
  'api-keys',
  'webhooks',
  'environments',
  'documentation',
  'team',
  'billing',
  'budgets',
  'security',
  'settings',
]

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

describe('useClientNav', () => {
  it('doit retourner 19 items : 3 sans groupe + 16 groupés', () => {
    const { nav } = setup()
    expect(nav.value).toHaveLength(19)
    expect(nav.value.filter((i) => !i.group)).toHaveLength(3)
    expect(nav.value.filter((i) => i.group)).toHaveLength(16)
  })

  it('doit retourner les items dans le bon ordre', () => {
    expect(setup().nav.value.map((i) => i.value)).toEqual(EXPECTED_ORDER)
  })

  it('doit avoir des values uniques et une icône Lucide par item', () => {
    const { nav } = setup()
    expect(new Set(nav.value.map((i) => i.value)).size).toBe(nav.value.length)
    for (const item of nav.value) expect(item.icon).toMatch(/^i-lucide-/)
  })

  it('doit grouper les 3 premiers items sans en-tête (home, chat, approvals)', () => {
    const { nav } = setup()
    expect(nav.value.slice(0, 3).map((i) => i.group)).toEqual([undefined, undefined, undefined])
  })

  it('doit utiliser les libellés Simple en mode Simple', () => {
    const { nav } = setup()
    expect(labelOf(nav, 'mcp-servers')).toBe('Accès IA')
    expect(labelOf(nav, 'mcp-servers')).not.toBe('Serveurs MCP')
    expect(labelOf(nav, 'approvals')).toBe('À valider')
    expect(labelOf(nav, 'agents')).toBe('Assistants')
    expect(labelOf(nav, 'environments')).toBe('Mode test')
  })

  it('doit utiliser les libellés Technique en mode Technique', () => {
    const { nav } = setup({ technical: true })
    expect(labelOf(nav, 'mcp-servers')).toBe('Serveurs MCP')
    expect(labelOf(nav, 'mcp-servers')).not.toBe('Accès IA')
    expect(labelOf(nav, 'approvals')).toBe('Approbations')
    expect(labelOf(nav, 'agents')).toBe('Agents')
    expect(labelOf(nav, 'environments')).toBe('Environnements')
  })

  it('doit réagir au basculement de mode sans recréer le composable', () => {
    const { nav, mode } = setup()
    expect(labelOf(nav, 'mcp-servers')).toBe('Accès IA')
    mode.toggle()
    expect(labelOf(nav, 'mcp-servers')).toBe('Serveurs MCP')
    mode.toggle()
    expect(labelOf(nav, 'mcp-servers')).toBe('Accès IA')
  })

  it('doit garder le même libellé dans les deux modes pour les items sans variante', () => {
    const simple = setup().nav
    const technical = setup({ technical: true }).nav
    for (const [value, label] of [
      ['home', 'Accueil'],
      ['chat', 'Discuter'],
      ['marketplace', 'Marketplace'],
      ['webhooks', 'Webhooks'],
      ['documentation', 'Documentation'],
      ['billing', 'Crédits et facturation'],
      ['budgets', 'Budgets'],
      ['settings', 'Réglages'],
    ] as const) {
      expect(labelOf(simple, value)).toBe(label)
      expect(labelOf(technical, value)).toBe(label)
    }
  })

  it('doit ne jamais renvoyer une clé i18n brute comme libellé', () => {
    for (const technical of [false, true]) {
      for (const item of setup({ technical }).nav.value) {
        expect(item.label).not.toMatch(/^cp\./)
        expect(item.label.length).toBeGreaterThan(0)
      }
    }
  })

  describe('badge approvals', () => {
    it('doit refléter pendingApprovals (nombre)', () => {
      const { nav } = setup({ pendingApprovals: { pendingApprovals: 4 } })
      expect(nav.value.find((i) => i.value === 'approvals')?.badge).toBe(4)
    })

    it('doit suivre une ref réactive', () => {
      const pending = ref(2)
      const { nav } = setup({ pendingApprovals: { pendingApprovals: pending } })
      expect(nav.value.find((i) => i.value === 'approvals')?.badge).toBe(2)
      pending.value = 9
      expect(nav.value.find((i) => i.value === 'approvals')?.badge).toBe(9)
    })

    it('doit être undefined sans option pendingApprovals', () => {
      expect(setup().nav.value.find((i) => i.value === 'approvals')?.badge).toBeUndefined()
    })

    it('doit ne produire aucune pastille quand il n y a rien à valider (0)', () => {
      const { nav } = setup({ pendingApprovals: { pendingApprovals: 0 } })
      expect(nav.value.find((i) => i.value === 'approvals')?.badge).toBeFalsy()
    })

    it('doit n affecter aucun autre item', () => {
      const { nav } = setup({ pendingApprovals: { pendingApprovals: 5 } })
      expect(nav.value.filter((i) => i.badge !== undefined).map((i) => i.value)).toEqual([
        'approvals',
      ])
    })
  })

  it('doit marquer documentation comme externe, et elle seule', () => {
    const { nav } = setup()
    expect(nav.value.find((i) => i.value === 'documentation')?.external).toBe(true)
    expect(nav.value.filter((i) => i.external).map((i) => i.value)).toEqual(['documentation'])
  })

  it('doit former les groupes Construire (5), Suivre (2), Développeurs (4), Organisation (5)', () => {
    const { nav } = setup()
    const groups = new Map<string, string[]>()
    for (const item of nav.value) {
      if (!item.group) continue
      groups.set(item.group, [...(groups.get(item.group) ?? []), item.value])
    }
    expect([...groups.keys()]).toEqual(['Construire', 'Suivre', 'Développeurs', 'Organisation'])
    expect(groups.get('Construire')).toHaveLength(5)
    expect(groups.get('Suivre')).toHaveLength(2)
    expect(groups.get('Développeurs')).toHaveLength(4)
    expect(groups.get('Organisation')).toHaveLength(5)
  })

  it('doit garder chaque groupe contigu (sinon l en-tête serait répété)', () => {
    const seen: string[] = []
    for (const item of setup().nav.value) {
      const group = item.group
      if (group && seen[seen.length - 1] !== group) {
        expect(seen).not.toContain(group)
        seen.push(group)
      }
    }
  })
})
