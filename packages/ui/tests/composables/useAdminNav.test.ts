import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { type ComputedRef, defineComponent, h } from 'vue'
import type { CpNavItem } from '../../app/components/Cp/SidebarNav.vue'
import { useAdminNav } from '../../app/composables/useAdminNav'

const mounted: VueWrapper[] = []

function setup(): ComputedRef<CpNavItem[]> {
  let nav: ComputedRef<CpNavItem[]> | undefined
  mounted.push(
    mount(
      defineComponent({
        setup() {
          nav = useAdminNav()
          return () => h('div')
        },
      }),
    ),
  )
  return nav as ComputedRef<CpNavItem[]>
}

const EXPECTED_ORDER = [
  'dashboard',
  'clients',
  'finance',
  'pricing',
  'providers',
  'gateway',
  'platform-ai',
  'api-keys',
  'mcp',
  'agents',
  'marketplace',
  'security',
  'compliance',
  'support',
  'system',
  'flags',
  'content',
  'internal-team',
  'parameters',
]

const itemsOfGroup = (nav: ComputedRef<CpNavItem[]>, group: string) =>
  nav.value.filter((i) => i.group === group).map((i) => i.value)

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

describe('useAdminNav', () => {
  it('doit retourner 19 items', () => {
    expect(setup().value).toHaveLength(19)
  })

  it('doit retourner les items dans le bon ordre', () => {
    expect(setup().value.map((i) => i.value)).toEqual(EXPECTED_ORDER)
  })

  it('doit avoir des values uniques, une icône Lucide et un libellé résolu', () => {
    const nav = setup()
    expect(new Set(nav.value.map((i) => i.value)).size).toBe(19)
    for (const item of nav.value) {
      expect(item.icon).toMatch(/^i-lucide-/)
      expect(item.label).not.toMatch(/^cp\./)
    }
  })

  it('doit commencer par dashboard, sans groupe', () => {
    const first = setup().value[0]
    expect(first?.value).toBe('dashboard')
    expect(first?.group).toBeUndefined()
    expect(first?.label).toBe('Pilotage')
  })

  it('doit former les groupes Clients et revenus (3), IA (3), Produit (4), Confiance (3), Exploitation (5)', () => {
    const nav = setup()
    expect(itemsOfGroup(nav, 'Clients et revenus')).toEqual(['clients', 'finance', 'pricing'])
    expect(itemsOfGroup(nav, 'IA')).toEqual(['providers', 'gateway', 'platform-ai'])
    expect(itemsOfGroup(nav, 'Produit')).toEqual(['api-keys', 'mcp', 'agents', 'marketplace'])
    expect(itemsOfGroup(nav, 'Confiance')).toEqual(['security', 'compliance', 'support'])
    expect(itemsOfGroup(nav, 'Exploitation')).toEqual([
      'system',
      'flags',
      'content',
      'internal-team',
      'parameters',
    ])
  })

  it('doit ne contenir aucun autre groupe, dans l ordre attendu', () => {
    const groups = [
      ...new Set(
        setup()
          .value.map((i) => i.group)
          .filter(Boolean),
      ),
    ]
    expect(groups).toEqual(['Clients et revenus', 'IA', 'Produit', 'Confiance', 'Exploitation'])
  })

  it('doit n avoir aucun item externe ni badge', () => {
    for (const item of setup().value) {
      expect(item.external).toBeUndefined()
      expect(item.badge).toBeUndefined()
    }
  })

  it('doit utiliser les mêmes libellés quel que soit le mode (pas de Simple/Technique en admin)', () => {
    // useAdminNav ne dépend pas de useCpMode : aucun fournisseur de mode requis.
    expect(setup().value.find((i) => i.value === 'security')?.label).toBe('Sécurité et abus')
  })
})
