import { mount as plainMount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import AdminShell from '../../app/components/Cp/AdminShell.vue'
import { mountWithMode } from '../mode'

const navItems = [
  { value: 'dashboard', icon: 'i-lucide-layout-dashboard', label: 'Pilotage' },
  { value: 'clients', icon: 'i-lucide-users', label: 'Clients', group: 'Clients et revenus' },
  { value: 'finance', icon: 'i-lucide-receipt', label: 'Finance', group: 'Clients et revenus' },
  { value: 'system', icon: 'i-lucide-activity', label: 'Système', group: 'Exploitation' },
]

const props = {
  navItems,
  currentNav: 'clients',
  userName: 'awa diop',
  userRole: 'Super administrateur',
}

const mounted: VueWrapper[] = []

const mount = (extra: Record<string, unknown> = {}, slots?: Record<string, () => unknown>) => {
  const { wrapper } = mountWithMode(AdminShell, { ...props, ...extra }, { slots })
  mounted.push(wrapper)
  return wrapper
}

const shell = (wrapper: ReturnType<typeof mount>) => wrapper.findComponent(AdminShell)

afterEach(() => {
  // Le tiroir écoute `keydown` sur document : on démonte pour ne pas fuiter entre les tests.
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

describe('CpAdminShell', () => {
  describe('logo', () => {
    it('doit afficher le nom du produit et le badge Admin par défaut', () => {
      const sidebar = mount().get('[data-cp-sidebar]')
      expect(sidebar.text()).toContain('project-cp')
      expect(sidebar.text()).toContain('Admin')
    })

    it('doit remplacer le logo par le slot logo', () => {
      const wrapper = mount({}, { logo: () => h('span', { 'data-logo': '' }, 'Mon logo') })
      expect(wrapper.get('[data-cp-sidebar] [data-logo]').text()).toBe('Mon logo')
      expect(wrapper.get('[data-cp-sidebar]').text()).not.toContain('project-cp')
    })
  })

  describe('navigation', () => {
    it('doit rendre CpSidebarNav en taille sm (min-h-8, text-body-sm)', () => {
      const items = mount().findAll('[data-cp-sidebar] [data-cp-nav-item]')
      expect(items).toHaveLength(navItems.length)
      for (const item of items) {
        expect(item.classes()).toContain('min-h-8')
        expect(item.classes()).toContain('text-body-sm')
        expect(item.classes()).not.toContain('min-h-11')
      }
    })

    it('doit marquer l élément courant et afficher les en-têtes de groupe', () => {
      const wrapper = mount()
      expect(wrapper.get('[data-nav="clients"]').attributes('aria-current')).toBe('page')
      expect(wrapper.get('[data-nav="dashboard"]').attributes('aria-current')).toBeUndefined()
      expect(wrapper.findAll('[data-cp-nav-group]').map((g) => g.text())).toEqual([
        'Clients et revenus',
        'Exploitation',
      ])
    })

    it('doit émettre navigate avec la valeur au clic sur un item', async () => {
      const wrapper = mount()
      await wrapper.get('[data-nav="system"]').trigger('click')
      expect(shell(wrapper).emitted('navigate')).toEqual([['system']])
    })

    it('doit étiqueter la navigation pour les lecteurs d écran', () => {
      const wrapper = mount()
      expect(wrapper.get('nav').attributes('aria-label')).toBe("Navigation de l'administration")
      expect(wrapper.get('[data-cp-sidebar]').attributes('aria-label')).toBe(
        "Navigation de l'administration",
      )
    })
  })

  describe('profil admin', () => {
    it('doit afficher le nom, le rôle et l initiale en bas de la barre latérale', () => {
      const profile = mount().get('[data-cp-admin-sidebar-profile]')
      expect(profile.text()).toContain('awa diop')
      expect(profile.text()).toContain('Super administrateur')
      expect(profile.text()).toContain('A')
    })

    it('doit afficher l icône 2FA quand has2fa est true', () => {
      const profile = mount({ has2fa: true }).get('[data-cp-admin-sidebar-profile]')
      expect(profile.find('[data-icon="i-lucide-shield-check"]').exists()).toBe(true)
    })

    it('doit masquer l icône 2FA quand has2fa est false ou absent', () => {
      expect(
        mount({ has2fa: false })
          .get('[data-cp-admin-sidebar-profile]')
          .find('[data-icon="i-lucide-shield-check"]')
          .exists(),
      ).toBe(false)
      expect(
        mount()
          .get('[data-cp-admin-sidebar-profile]')
          .find('[data-icon="i-lucide-shield-check"]')
          .exists(),
      ).toBe(false)
    })
  })

  describe('barre du haut', () => {
    it('doit afficher le badge d environnement quand environmentLabel est fourni', () => {
      expect(mount({ environmentLabel: 'Production' }).get('[data-cp-env-badge]').text()).toBe(
        'Production',
      )
    })

    it('doit masquer le badge d environnement sans environmentLabel', () => {
      expect(mount().find('[data-cp-env-badge]').exists()).toBe(false)
    })

    it('doit afficher le minuteur de session en aria-live="polite"', () => {
      const timer = mount({ sessionTimeRemaining: '12 min' }).get('[data-cp-session-timer]')
      expect(timer.text()).toContain('Session : 12 min')
      expect(timer.attributes('aria-live')).toBe('polite')
    })

    it('doit masquer le minuteur de session sans sessionTimeRemaining', () => {
      expect(mount().find('[data-cp-session-timer]').exists()).toBe(false)
    })

    it('doit émettre search et profile', async () => {
      const wrapper = mount()
      await wrapper.get('[data-cp-search]').trigger('click')
      await wrapper.get('[data-cp-admin-profile]').trigger('click')
      expect(shell(wrapper).emitted('search')).toHaveLength(1)
      expect(shell(wrapper).emitted('profile')).toHaveLength(1)
    })
  })

  describe('arrêt d urgence', () => {
    it('doit toujours être visible, étiqueté et sans état pressé par défaut', () => {
      const button = mount().get('[data-cp-emergency-stop]')
      expect(button.attributes('aria-label')).toBe("Arrêt d'urgence")
      expect(button.attributes('aria-pressed')).toBeUndefined()
      expect(button.classes()).not.toContain('animate-pulse')
      expect(button.classes()).toContain('bg-cp-danger')
    })

    it('doit émettre emergency-stop au clic', async () => {
      const wrapper = mount()
      await wrapper.get('[data-cp-emergency-stop]').trigger('click')
      expect(shell(wrapper).emitted('emergency-stop')).toHaveLength(1)
    })

    it('doit rester visible et cliquable quand l arrêt est déjà actif', async () => {
      const wrapper = mount({ emergencyStopActive: true })
      await wrapper.get('[data-cp-emergency-stop]').trigger('click')
      expect(shell(wrapper).emitted('emergency-stop')).toHaveLength(1)
    })

    it('doit exposer aria-pressed="true" et animate-pulse quand emergencyStopActive est true', () => {
      const button = mount({ emergencyStopActive: true }).get('[data-cp-emergency-stop]')
      expect(button.attributes('aria-pressed')).toBe('true')
      expect(button.classes()).toContain('animate-pulse')
    })

    it('doit retirer aria-pressed et animate-pulse quand l arrêt est levé', async () => {
      // Montage direct (setProps n'est possible que sur le composant racine).
      const wrapper = plainMount(AdminShell, { props: { ...props, emergencyStopActive: true } })
      mounted.push(wrapper)
      expect(wrapper.get('[data-cp-emergency-stop]').attributes('aria-pressed')).toBe('true')
      await wrapper.setProps({ emergencyStopActive: false })
      const button = wrapper.get('[data-cp-emergency-stop]')
      expect(button.attributes('aria-pressed')).toBeUndefined()
      expect(button.classes()).not.toContain('animate-pulse')
    })
  })

  describe('différences avec le shell client', () => {
    it('ne doit pas avoir de barre d onglets mobile', () => {
      expect(mount().find('[data-cp-tabbar]').exists()).toBe(false)
    })

    it('ne doit pas avoir de ModeToggle', () => {
      expect(mount().find('[data-cp-mode-toggle]').exists()).toBe(false)
    })
  })

  describe('accessibilité et contenu', () => {
    it('doit proposer un skip link vers #cp-admin-main dont la cible est le main', () => {
      const wrapper = mount()
      expect(wrapper.get('[data-cp-skip-link]').attributes('href')).toBe('#cp-admin-main')
      expect(wrapper.get('main').attributes('id')).toBe('cp-admin-main')
    })

    it('doit rendre le slot par défaut dans main', () => {
      const wrapper = mount({}, { default: () => h('p', { 'data-page': '' }, 'Page') })
      expect(wrapper.get('main [data-page]').text()).toBe('Page')
      expect(wrapper.get('[data-cp-admin-content]').element.tagName).toBe('MAIN')
    })
  })

  describe('tiroir mobile', () => {
    const sidebar = (w: ReturnType<typeof mount>) => w.get('[data-cp-sidebar]')
    const scrim = (w: ReturnType<typeof mount>) => w.get('[data-cp-scrim]')

    it('doit être fermé au départ (pas de role dialog, scrim inactif, pas d inert)', () => {
      const wrapper = mount()
      expect(sidebar(wrapper).attributes('role')).toBeUndefined()
      expect(sidebar(wrapper).classes()).toContain('-translate-x-full')
      expect(scrim(wrapper).classes()).toContain('pointer-events-none')
      expect(wrapper.get('[data-cp-admin-drawer-open]').attributes('aria-expanded')).toBe('false')
      expect(wrapper.find('[data-cp-drawer-close]').exists()).toBe(false)
      expect(wrapper.get('main').element.parentElement?.hasAttribute('inert')).toBe(false)
    })

    it('doit s ouvrir via le bouton menu (dialog modal, scrim actif, contenu inert)', async () => {
      const wrapper = mount()
      await wrapper.get('[data-cp-admin-drawer-open]').trigger('click')
      expect(sidebar(wrapper).attributes('role')).toBe('dialog')
      expect(sidebar(wrapper).attributes('aria-modal')).toBe('true')
      expect(sidebar(wrapper).classes()).toContain('translate-x-0')
      expect(scrim(wrapper).classes()).not.toContain('pointer-events-none')
      expect(wrapper.get('[data-cp-admin-drawer-open]').attributes('aria-expanded')).toBe('true')
      expect(wrapper.get('main').element.parentElement?.hasAttribute('inert')).toBe(true)
    })

    it('doit se fermer via le bouton de fermeture', async () => {
      const wrapper = mount()
      await wrapper.get('[data-cp-admin-drawer-open]').trigger('click')
      await wrapper.get('[data-cp-drawer-close]').trigger('click')
      expect(scrim(wrapper).classes()).toContain('pointer-events-none')
      expect(sidebar(wrapper).attributes('role')).toBeUndefined()
    })

    it('doit se fermer au clic sur le scrim', async () => {
      const wrapper = mount()
      await wrapper.get('[data-cp-admin-drawer-open]').trigger('click')
      await scrim(wrapper).trigger('click')
      expect(scrim(wrapper).classes()).toContain('pointer-events-none')
    })

    it('doit se fermer avec Échap', async () => {
      const wrapper = mount()
      await wrapper.get('[data-cp-admin-drawer-open]').trigger('click')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await wrapper.vm.$nextTick()
      expect(scrim(wrapper).classes()).toContain('pointer-events-none')
      expect(sidebar(wrapper).attributes('role')).toBeUndefined()
    })

    it('doit ignorer Échap quand le tiroir est fermé', async () => {
      const wrapper = mount()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await wrapper.vm.$nextTick()
      expect(sidebar(wrapper).attributes('role')).toBeUndefined()
      expect(scrim(wrapper).classes()).toContain('pointer-events-none')
    })

    it('doit se fermer après une navigation et l émettre', async () => {
      const wrapper = mount()
      await wrapper.get('[data-cp-admin-drawer-open]').trigger('click')
      await wrapper.get('[data-nav="finance"]').trigger('click')
      expect(scrim(wrapper).classes()).toContain('pointer-events-none')
      expect(shell(wrapper).emitted('navigate')).toEqual([['finance']])
    })

    describe('piège à focus (tiroir ouvert)', () => {
      const open = async () => {
        const wrapper = plainMount(AdminShell, { props, attachTo: document.body })
        mounted.push(wrapper)
        await wrapper.get('[data-cp-admin-drawer-open]').trigger('click')
        return wrapper
      }
      const tab = (shiftKey: boolean) => {
        const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true })
        document.dispatchEvent(event)
        return event
      }

      it('doit ramener le focus au premier élément quand Tab part du dernier', async () => {
        const wrapper = await open()
        const first = wrapper.get('[data-cp-drawer-close]').element as HTMLElement
        const last = wrapper.get('[data-nav="system"]').element as HTMLElement
        last.focus()
        const event = tab(false)
        expect(event.defaultPrevented).toBe(true)
        expect(document.activeElement).toBe(first)
      })

      it('doit ramener le focus au dernier élément quand Maj+Tab part du premier', async () => {
        const wrapper = await open()
        const first = wrapper.get('[data-cp-drawer-close]').element as HTMLElement
        const last = wrapper.get('[data-nav="system"]').element as HTMLElement
        first.focus()
        const event = tab(true)
        expect(event.defaultPrevented).toBe(true)
        expect(document.activeElement).toBe(last)
      })

      it('doit laisser Tab tranquille au milieu du tiroir', async () => {
        const wrapper = await open()
        ;(wrapper.get('[data-nav="clients"]').element as HTMLElement).focus()
        expect(tab(false).defaultPrevented).toBe(false)
      })

      it('doit ignorer Tab quand le tiroir est fermé', () => {
        const wrapper = plainMount(AdminShell, { props, attachTo: document.body })
        mounted.push(wrapper)
        expect(tab(false).defaultPrevented).toBe(false)
      })
    })

    it('doit retirer son écouteur clavier au démontage', () => {
      const remove = vi.spyOn(document, 'removeEventListener')
      const wrapper = mount()
      wrapper.unmount()
      mounted.pop()
      expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function))
      remove.mockRestore()
    })
  })
})
