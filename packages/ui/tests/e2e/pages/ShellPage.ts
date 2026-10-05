import { expect, type Locator, type Page } from '@playwright/test'
import fr from '../../../i18n/locales/fr.json' with { type: 'json' }
import { gotoHydrated } from '../helpers'

const s = fr.cp.shell
const a = fr.cp.admin

/** Comportements communs aux deux shells (tiroir mobile, skip link, contenu). */
abstract class ShellPage {
  abstract readonly path: string
  abstract readonly navLabel: string
  readonly openMenuButton: Locator
  readonly main: Locator
  readonly log: Locator
  readonly scrim: Locator
  readonly skipLink: Locator
  readonly closeMenuButton: Locator

  constructor(readonly page: Page) {
    this.openMenuButton = page.getByRole('button', { name: s.openMenu })
    this.main = page.getByRole('main')
    this.log = page.getByTestId('log')
    this.scrim = page.locator('[data-cp-scrim]')
    this.skipLink = page.getByRole('link', { name: s.skipLink })
    this.closeMenuButton = page.getByRole('button', { name: s.closeMenu })
  }

  async goto(): Promise<void> {
    await gotoHydrated(this.page, this.path)
  }

  get nav(): Locator {
    return this.page.getByRole('navigation', { name: this.navLabel })
  }

  get drawer(): Locator {
    return this.page.getByRole('dialog', { name: this.navLabel })
  }

  navItem(name: string | RegExp): Locator {
    return this.nav.getByRole('link', { name })
  }

  async openDrawer(): Promise<void> {
    await this.openMenuButton.click()
    await expect(this.drawer).toBeVisible()
  }
}

export class AppShellPage extends ShellPage {
  readonly path = '/app'
  readonly navLabel = s.nav
  readonly tabbar: Locator
  readonly search: Locator
  readonly notifications: Locator
  readonly profile: Locator
  readonly orgSelector: Locator

  constructor(page: Page) {
    super(page)
    this.tabbar = page.getByRole('navigation', { name: s.tabs })
    this.search = page.getByRole('button', { name: s.search })
    this.notifications = page.getByRole('button', { name: s.notifications })
    this.profile = page.getByRole('button', { name: s.profile })
    this.orgSelector = page.getByRole('button', { name: new RegExp(s.switchOrg) })
  }

  tab(name: string): Locator {
    return this.tabbar.getByRole('button', { name })
  }
}

export class AdminShellPage extends ShellPage {
  readonly path = '/admin'
  readonly navLabel = a.nav
  readonly emergencyStop: Locator
  readonly profile: Locator
  readonly sessionTimer: Locator
  readonly envBadge: Locator

  constructor(page: Page) {
    super(page)
    this.emergencyStop = page.getByRole('button', { name: a.emergencyStop })
    this.profile = page.getByRole('button', { name: a.profile })
    this.sessionTimer = page.getByText(a.sessionRemaining.replace('{time}', '14 min'))
    this.envBadge = page.getByText('Production', { exact: true })
  }
}
