import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SidebarNav, { type CpNavItem } from '../../app/components/Cp/SidebarNav.vue'

const items: CpNavItem[] = [
  { value: 'home', icon: 'i-lucide-house', label: 'Accueil' },
  { value: 'agents', icon: 'i-lucide-bot', label: 'Assistants', group: 'Construire' },
  {
    value: 'connectors',
    icon: 'i-lucide-plug',
    label: 'Systèmes connectés',
    group: 'Construire',
    badge: 7,
  },
  { value: 'activity', icon: 'i-lucide-play', label: 'Activité', group: 'Suivre' },
  {
    value: 'documentation',
    icon: 'i-lucide-book-open',
    label: 'Documentation',
    group: 'Suivre',
    external: true,
    href: 'https://docs.example.com',
  },
]

const mountNav = (props: Record<string, unknown> = {}) =>
  mount(SidebarNav, { props: { items, currentNav: 'agents', ...props } })

const item = (wrapper: ReturnType<typeof mountNav>, value: string) =>
  wrapper.get(`[data-nav="${value}"]`)

describe('CpSidebarNav', () => {
  it('doit afficher un élément par entrée avec le bon libellé', () => {
    const wrapper = mountNav()
    expect(wrapper.findAll('[data-cp-nav-item]').map((i) => i.attributes('data-nav'))).toEqual([
      'home',
      'agents',
      'connectors',
      'activity',
      'documentation',
    ])
    expect(item(wrapper, 'home').text()).toBe('Accueil')
    expect(item(wrapper, 'activity').text()).toBe('Activité')
  })

  it('doit afficher l icône de chaque entrée', () => {
    const wrapper = mountNav()
    expect(item(wrapper, 'agents').get('[data-icon="i-lucide-bot"]').exists()).toBe(true)
  })

  it('doit afficher un en-tête seulement quand le groupe change (pas quand il se répète)', () => {
    const wrapper = mountNav()
    expect(wrapper.findAll('[data-cp-nav-group]').map((g) => g.text())).toEqual([
      'Construire',
      'Suivre',
    ])
  })

  it('doit n afficher aucun en-tête quand aucun item n a de groupe', () => {
    const wrapper = mountNav({ items: items.slice(0, 1) })
    expect(wrapper.find('[data-cp-nav-group]').exists()).toBe(false)
  })

  it('doit placer l en-tête juste avant le premier item de son groupe', () => {
    const wrapper = mountNav()
    const heading = wrapper.get('[data-cp-nav-group]')
    expect(heading.element.nextElementSibling?.getAttribute('data-nav')).toBe('agents')
  })

  it('doit marquer l élément actif (bg-cp-primary-soft, aria-current="page")', () => {
    const active = item(mountNav(), 'agents')
    expect(active.classes()).toContain('bg-cp-primary-soft')
    expect(active.attributes('aria-current')).toBe('page')
  })

  it('doit laisser l élément inactif sans aria-current ni fond actif', () => {
    const inactive = item(mountNav(), 'home')
    expect(inactive.attributes('aria-current')).toBeUndefined()
    expect(inactive.classes()).not.toContain('bg-cp-primary-soft')
  })

  it('doit n avoir aucun élément actif quand currentNav est inconnu', () => {
    const wrapper = mountNav({ currentNav: 'inconnu' })
    expect(wrapper.find('[aria-current]').exists()).toBe(false)
  })

  it('doit afficher le badge avec le bon nombre', () => {
    const wrapper = mountNav()
    expect(item(wrapper, 'connectors').get('[data-cp-nav-badge]').text()).toBe('7')
    expect(wrapper.findAll('[data-cp-nav-badge]')).toHaveLength(1)
  })

  it('doit omettre le badge quand badge est undefined', () => {
    expect(item(mountNav(), 'home').find('[data-cp-nav-badge]').exists()).toBe(false)
  })

  it('doit omettre le badge quand il vaut 0', () => {
    const wrapper = mountNav({ items: [{ ...items[0], badge: 0 }] })
    expect(wrapper.find('[data-cp-nav-badge]').exists()).toBe(false)
  })

  it('doit rendre un lien externe sécurisé (target, rel, marqueur, icône external-link)', () => {
    const link = item(mountNav(), 'documentation')
    expect(link.element.tagName).toBe('A')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(link.attributes('href')).toBe('https://docs.example.com')
    expect(link.attributes('data-cp-nav-external')).toBeDefined()
    expect(link.attributes('type')).toBeUndefined()
    expect(link.find('[data-icon="i-lucide-external-link"]').exists()).toBe(true)
  })

  it('doit rendre un item interne en NuxtLink (lien, sans target ni rel ni marqueur externe)', () => {
    const link = item(mountNav(), 'home')
    expect(link.element.tagName).toBe('A')
    expect(link.attributes('target')).toBeUndefined()
    expect(link.attributes('rel')).toBeUndefined()
    expect(link.attributes('data-cp-nav-external')).toBeUndefined()
    expect(link.find('[data-icon="i-lucide-external-link"]').exists()).toBe(false)
  })

  it('doit cibler la route `to` quand elle est fournie', () => {
    const wrapper = mountNav({ items: [{ ...items[0], to: '/accueil' }] })
    expect(item(wrapper, 'home').attributes('href')).toBe('/accueil')
  })

  it('doit désactiver un item locked : aria-disabled, hors tabulation, icône cadenas + mot', () => {
    const wrapper = mountNav({ items: [{ ...items[1], locked: true, badge: 3 }] })
    const locked = item(wrapper, 'agents')
    expect(locked.attributes('aria-disabled')).toBe('true')
    expect(locked.attributes('tabindex')).toBe('-1')
    expect(locked.attributes('aria-current')).toBeUndefined()
    expect(locked.attributes('data-cp-nav-locked')).toBeDefined()
    expect(locked.classes()).toContain('text-cp-ink-disabled')
    expect(locked.find('[data-icon="i-lucide-lock"]').exists()).toBe(true)
    expect(locked.text()).toContain('Non inclus dans votre plan')
    expect(locked.find('[data-cp-nav-badge]').exists()).toBe(false)
  })

  it('doit ne pas naviguer ni émettre navigate au clic sur un item locked', async () => {
    const wrapper = mountNav({ items: [{ ...items[0], locked: true, to: '/accueil' }] })
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    item(wrapper, 'home').element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('navigate')).toBeUndefined()
  })

  it('doit appliquer la taille sm (min-h-8, text-body-sm)', () => {
    const classes = item(mountNav({ size: 'sm' }), 'home').classes()
    expect(classes).toContain('min-h-8')
    expect(classes).toContain('text-body-sm')
    expect(classes).not.toContain('min-h-11')
  })

  it('doit appliquer la taille md par défaut (min-h-11, text-label)', () => {
    const classes = item(mountNav(), 'home').classes()
    expect(classes).toContain('min-h-11')
    expect(classes).toContain('text-label')
    expect(classes).not.toContain('min-h-8')
  })

  it('doit émettre navigate avec la valeur au clic sur un item non externe', async () => {
    const wrapper = mountNav()
    await item(wrapper, 'activity').trigger('click')
    expect(wrapper.emitted('navigate')).toEqual([['activity']])
  })

  it('doit émettre navigate aussi pour l item déjà actif', async () => {
    const wrapper = mountNav()
    await item(wrapper, 'agents').trigger('click')
    expect(wrapper.emitted('navigate')).toEqual([['agents']])
  })

  it('doit ne pas émettre navigate au clic sur un item externe', async () => {
    const wrapper = mountNav()
    // Empêche happy-dom de tenter une vraie navigation réseau vers le lien externe.
    wrapper.element.addEventListener('click', (event) => event.preventDefault())
    await item(wrapper, 'documentation').trigger('click')
    expect(wrapper.emitted('navigate')).toBeUndefined()
  })

  it('doit rendre une liste vide sans erreur', () => {
    const wrapper = mountNav({ items: [] })
    expect(wrapper.findAll('[data-cp-nav-item]')).toHaveLength(0)
  })
})
