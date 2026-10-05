import { mount as plainMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import AppShell from '../../app/components/Cp/AppShell.vue'
import { mountWithMode } from '../mode'

const navItems = [
  { label: 'Accueil', icon: 'i-lucide-house', value: 'home' },
  { label: 'Assistants', icon: 'i-lucide-bot', value: 'agents', group: 'Construire' },
  {
    label: 'Systèmes connectés',
    icon: 'i-lucide-plug',
    value: 'connectors',
    group: 'Construire',
    badge: 2,
  },
  { label: 'Activité', icon: 'i-lucide-play', value: 'activity', group: 'Suivre' },
]

const props = { navItems, currentNav: 'agents' }

const mount = (extra: Record<string, unknown> = {}, slots?: Record<string, () => unknown>) =>
  mountWithMode(AppShell, { ...props, ...extra }, { slots }).wrapper

describe('CpAppShell', () => {
  it('affiche la navigation fournie, élément courant en primary-soft', () => {
    const wrapper = mount()
    const items = wrapper.findAll('[data-cp-sidebar] [data-nav]')
    expect(items.map((i) => i.text())).toEqual([
      'Accueil',
      'Assistants',
      'Systèmes connectés2',
      'Activité',
    ])
    const current = wrapper.get('[data-cp-sidebar] [data-nav="agents"]')
    expect(current.classes()).toContain('bg-cp-primary-soft')
    expect(current.attributes('aria-current')).toBe('page')
    expect(
      wrapper.get('[data-cp-sidebar] [data-nav="home"]').attributes('aria-current'),
    ).toBeUndefined()
  })

  it('titres de groupe quand le groupe change, pastille de compteur', () => {
    const wrapper = mount()
    expect(wrapper.findAll('[data-cp-nav-group]').map((g) => g.text())).toEqual([
      'Construire',
      'Suivre',
    ])
    expect(wrapper.get('[data-cp-nav-badge]').text()).toBe('2')
  })

  it('barre latérale surface-sunken', () => {
    const wrapper = mount()
    expect(wrapper.get('[data-cp-sidebar]').classes()).toContain('bg-cp-surface-sunken')
  })

  it('émet navigate avec la valeur de l entrée', async () => {
    const wrapper = mount()
    await wrapper.get('[data-cp-sidebar] [data-nav="activity"]').trigger('click')
    expect(wrapper.findComponent(AppShell).emitted('navigate')).toEqual([['activity']])
  })

  it('émet search, notifications et profile', async () => {
    const wrapper = mount()
    await wrapper.get('[data-cp-search]').trigger('click')
    await wrapper.get('[data-cp-notifications]').trigger('click')
    await wrapper.get('[data-cp-profile]').trigger('click')
    const shell = wrapper.findComponent(AppShell)
    for (const event of ['search', 'notifications', 'profile']) {
      expect(shell.emitted(event)).toHaveLength(1)
    }
  })

  it('barre du haut : jeton de crédits amber-soft, compteur de notifications, ModeToggle', () => {
    const wrapper = mount({ creditsLabel: '12 430 cr', notificationCount: 3 })
    const credits = wrapper.get('[data-cp-credits]')
    expect(credits.classes()).toContain('bg-cp-amber-soft')
    expect(credits.text()).toContain('12 430 cr')
    expect(wrapper.get('[data-cp-notification-count]').text()).toBe('3')
    expect(wrapper.get('[data-cp-topbar] [data-cp-mode-toggle]').exists()).toBe(true)
  })

  it('sans crédits ni notifications : rien d affiché', () => {
    const wrapper = mount()
    expect(wrapper.find('[data-cp-credits]').exists()).toBe(false)
    expect(wrapper.find('[data-cp-notification-count]').exists()).toBe(false)
  })

  it('initiale du profil quand le nom est connu', () => {
    expect(mount({ userName: 'awa' }).get('[data-cp-profile]').text()).toBe('A')
  })

  it('slots : contenu de page, logo, actions de la barre du haut', () => {
    const wrapper = mount(
      {},
      {
        default: () => h('p', { 'data-page': '' }, 'Page'),
        logo: () => h('span', { 'data-logo': '' }, 'Logo'),
        'topbar-actions': () => h('span', { 'data-extra': '' }, 'Extra'),
      },
    )
    expect(wrapper.get('[data-cp-content] [data-page]').text()).toBe('Page')
    expect(wrapper.get('[data-cp-sidebar] [data-logo]').exists()).toBe(true)
    expect(wrapper.get('[data-cp-topbar] [data-extra]').exists()).toBe(true)
  })

  it('logo par défaut : nom du produit', () => {
    expect(mount().get('[data-cp-sidebar]').text()).toContain('project-cp')
  })

  it('mobile : barre d onglets Accueil, Discuter, À valider, Crédits', async () => {
    const wrapper = mount({ currentNav: 'chat' })
    const tabs = wrapper.findAll('[data-cp-tabbar] [data-tab]')
    expect(tabs.map((t) => t.text())).toEqual(['Accueil', 'Discuter', 'À valider', 'Crédits'])
    expect(wrapper.get('[data-tab="chat"]').attributes('aria-current')).toBe('page')
    await wrapper.get('[data-tab="credits"]').trigger('click')
    expect(wrapper.findComponent(AppShell).emitted('navigate')).toEqual([['credits']])
  })

  it('mobile : le tiroir s ouvre, se ferme (bouton, fond, Échap, navigation)', async () => {
    const wrapper = mount()
    const sidebar = () => wrapper.get('[data-cp-sidebar]')
    const scrim = () => wrapper.get('[data-cp-scrim]')
    expect(sidebar().attributes('role')).toBeUndefined()
    expect(scrim().classes()).toContain('pointer-events-none')

    await wrapper.get('[data-cp-drawer-open]').trigger('click')
    expect(sidebar().attributes('role')).toBe('dialog')
    expect(sidebar().attributes('aria-modal')).toBe('true')
    expect(wrapper.find('[data-cp-drawer-mode]').exists()).toBe(true)
    expect(scrim().classes()).not.toContain('pointer-events-none')

    await wrapper.get('[data-cp-drawer-close]').trigger('click')
    expect(scrim().classes()).toContain('pointer-events-none')

    await wrapper.get('[data-cp-drawer-open]').trigger('click')
    await scrim().trigger('click')
    expect(scrim().classes()).toContain('pointer-events-none')

    await wrapper.get('[data-cp-drawer-open]').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(scrim().classes()).toContain('pointer-events-none')

    await wrapper.get('[data-cp-drawer-open]').trigger('click')
    await wrapper.get('[data-cp-sidebar] [data-nav="home"]').trigger('click')
    expect(scrim().classes()).toContain('pointer-events-none')
  })

  it('le mode Technique est fourni aux pages même sans fournisseur en racine', async () => {
    const wrapper = plainMount(AppShell, { props })
    await wrapper.get('[data-cp-topbar] [data-value="technical"]').trigger('click')
    expect(
      wrapper.get('[data-cp-topbar] [data-value="technical"]').attributes('aria-checked'),
    ).toBe('true')
  })
})
