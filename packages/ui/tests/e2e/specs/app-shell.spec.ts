import { expect, test } from '@playwright/test'
import fr from '../../../i18n/locales/fr.json' with { type: 'json' }
import { isDark, isMobile } from '../helpers'
import { AppShellPage } from '../pages/ShellPage'

// Parcours client : AppShell + SidebarNav + OrgSelector (maquette docs/maquettes/7-navigation/42-NavApp.png).

test.describe('AppShell — thèmes', () => {
  test('les tokens appliquent le bon thème (classe .dark, fond canvas, texte ink)', async ({
    page,
  }, info) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    await expect(page.locator('html')).toHaveClass(
      isDark(info.project.name) ? /\bdark\b/ : /^(?!.*\bdark\b)/,
    )
    const colors = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement)
      const probe = (token: string) => {
        const el = document.createElement('span')
        el.style.color = `var(${token})`
        document.body.append(el)
        const value = getComputedStyle(el).color
        el.remove()
        return value
      }
      return {
        canvasToken: probe('--cp-canvas'),
        inkToken: probe('--cp-ink'),
        shellBg: getComputedStyle(document.querySelector('[data-cp-app-shell]') as Element)
          .backgroundColor,
        shellInk: getComputedStyle(document.querySelector('[data-cp-app-shell]') as Element).color,
        sidebarBg: getComputedStyle(document.querySelector('[data-cp-sidebar]') as Element)
          .backgroundColor,
        sunkenToken: probe('--cp-surface-sunken'),
        declared: root.getPropertyValue('--cp-canvas').trim(),
      }
    })
    expect(colors.declared).not.toBe('')
    expect(colors.shellBg).toBe(colors.canvasToken)
    expect(colors.shellInk).toBe(colors.inkToken)
    expect(colors.sidebarBg).toBe(colors.sunkenToken)
  })

  test('capture complète de la coquille', async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    await expect(shell.main).toBeVisible()
    await expect(page).toHaveScreenshot('app-shell.png')
  })
})

test.describe('AppShell — desktop', () => {
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixtures arg
  test.beforeEach(({}, testInfo) =>
    test.skip(isMobile(testInfo.project.name), 'desktop uniquement'),
  )

  test('sidebar visible, élément courant en aria-current, onglets mobiles et bouton menu masqués', async ({
    page,
  }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    await expect(shell.nav).toBeVisible()
    await expect(shell.navItem('Accueil')).toHaveAttribute('aria-current', 'page')
    await expect(shell.navItem('Assistants')).not.toHaveAttribute('aria-current', /.+/)
    await expect(shell.tabbar).toBeHidden()
    await expect(shell.openMenuButton).toBeHidden()
    await expect(page.getByText('Construire', { exact: true })).toBeVisible()
    await expect(page.getByText('Suivre', { exact: true })).toBeVisible()
    await expect(shell.navItem(/Systèmes connectés/)).toBeVisible()
  })

  test('cliquer un item émet navigate et déplace aria-current', async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    await shell.navItem('Assistants').click()
    await expect(shell.navItem('Assistants')).toHaveAttribute('aria-current', 'page')
    await expect(shell.navItem('Accueil')).not.toHaveAttribute('aria-current', /.+/)
    await expect(shell.log).toHaveText('nav:agents')
    await expect(shell.main.getByRole('heading')).toHaveText('Page : agents')
  })

  test('hauteur des items : 32px desktop (maquette 42 : 19 entrées tiennent en 1000 px), 44px mobile', async ({
    page,
  }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    const box = await shell.navItem('Accueil').boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(32)
    expect(box?.height).toBeLessThanOrEqual(36)
  })

  test("barre du haut : crédits, notifications (3), recherche, profil, sélecteur d'organisation", async ({
    page,
  }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    await expect(page.getByText('12 480 crédits')).toBeVisible()
    await expect(shell.notifications).toContainText('3')
    await shell.search.click()
    await shell.notifications.click()
    await shell.profile.click()
    await shell.orgSelector.click()
    await expect(shell.log).toHaveText('search,notifications,profile,switch-org')
    await expect(shell.orgSelector).toContainText('Atelier Douala')
    await expect(shell.orgSelector).toContainText('Formule Starter')
  })

  test('skip link : premier arrêt au clavier, visible au focus, cible le contenu', async ({
    page,
  }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    await page.keyboard.press('Tab')
    await expect(shell.skipLink).toBeFocused()
    await expect(shell.skipLink).toBeVisible()
    await expect(page).toHaveScreenshot('app-shell-skip-link.png', {
      clip: { x: 0, y: 0, width: 400, height: 120 },
    })
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#cp-main$/)
  })

  test('navigation au clavier : Tab atteint les items, Entrée active', async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    await shell.navItem('Activité').focus()
    await page.keyboard.press('Enter')
    await expect(shell.navItem('Activité')).toHaveAttribute('aria-current', 'page')
  })

  test("mode Technique : l'interrupteur Simple/Technique bascule l'état coché", async ({
    page,
  }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    const toggle = page.getByRole('radiogroup', { name: fr.cp.mode.label })
    await expect(toggle).toBeVisible()
    await expect(toggle.getByRole('radio', { name: fr.cp.mode.simple })).toBeChecked()
    await toggle.getByRole('radio', { name: fr.cp.mode.technique }).click()
    await expect(toggle.getByRole('radio', { name: fr.cp.mode.technique })).toBeChecked()
    await expect(toggle.getByRole('radio', { name: fr.cp.mode.simple })).not.toBeChecked()
  })

  test('mode Technique : le libellé nav « Assistants » devient « Agents »', async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    const nav = shell.nav
    await expect(nav.getByRole('link', { name: fr.cp.nav.agents.simple })).toBeVisible()
    const toggle = page.getByRole('radiogroup', { name: fr.cp.mode.label })
    await toggle.getByRole('radio', { name: fr.cp.mode.technique }).click()
    await expect(nav.getByRole('link', { name: fr.cp.nav.agents.technical })).toBeVisible()
    await expect(nav.getByRole('link', { name: fr.cp.nav.agents.simple })).toHaveCount(0)
  })
})

test.describe('AppShell — mobile 375×667', () => {
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixtures arg
  test.beforeEach(({}, testInfo) =>
    test.skip(!isMobile(testInfo.project.name), 'mobile uniquement'),
  )

  test('aucun débordement horizontal (viewport 375 px respecté)', async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    expect(innerWidth).toBe(375)
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
  })

  test('tiroir fermé : sidebar masquée, onglets visibles, bouton menu replié', async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    await expect(shell.nav).toBeHidden()
    await expect(shell.tabbar).toBeVisible()
    await expect(shell.openMenuButton).toHaveAttribute('aria-expanded', 'false')
    await expect(shell.tab('Accueil')).toHaveAttribute('aria-current', 'page')
    await expect(shell.tab('Discuter')).not.toHaveAttribute('aria-current', /.+/)
  })

  test('ouverture : dialogue modal, focus sur Fermer, contenu inerte, scrim visible', async ({
    page,
  }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    await shell.openDrawer()
    await expect(shell.drawer).toHaveAttribute('aria-modal', 'true')
    await expect(shell.openMenuButton).toHaveAttribute('aria-expanded', 'true')
    await expect(shell.closeMenuButton).toBeFocused()
    await expect(shell.scrim).toHaveCSS('opacity', '1')
    await expect(page.locator('[data-cp-app-shell] > div.min-w-0')).toHaveAttribute('inert', '')
    await expect(page).toHaveScreenshot('app-shell-drawer-open.png')
  })

  test("le tiroir glisse (translate animé), il n'apparaît pas instantanément", async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    const aside = page.locator('[data-cp-sidebar]')
    // Tailwind v4 anime la propriété `translate` (et non `transform`) : "-256px" fermé, "none"/"0px" ouvert.
    const offsetX = () =>
      aside.evaluate((el) => Number.parseFloat(getComputedStyle(el).translate) || 0)
    expect(await offsetX()).toBeLessThan(0)
    await shell.openMenuButton.click()
    await expect(shell.drawer).toBeVisible()
    await expect.poll(offsetX).toBe(0)
  })

  test('fermeture : bouton Fermer, Échap, clic sur le scrim — le focus revient sur le bouton menu', async ({
    page,
  }) => {
    const shell = new AppShellPage(page)
    await shell.goto()

    await shell.openDrawer()
    await shell.closeMenuButton.click()
    await expect(shell.drawer).toBeHidden()
    await expect(shell.openMenuButton).toBeFocused()

    await shell.openDrawer()
    await page.keyboard.press('Escape')
    await expect(shell.drawer).toBeHidden()
    await expect(shell.openMenuButton).toBeFocused()

    await shell.openDrawer()
    await page.mouse.click(370, 600) // zone du scrim, à droite du tiroir (256px)
    await expect(shell.drawer).toBeHidden()
    await expect(shell.scrim).toHaveCSS('opacity', '0')
  })

  test('choisir un item dans le tiroir navigue et ferme le tiroir', async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    await shell.openDrawer()
    await shell.navItem('Assistants').click()
    await expect(shell.log).toHaveText('nav:agents')
    await expect(shell.nav).toBeHidden()
    await expect(shell.tab('Accueil')).not.toHaveAttribute('aria-current', /.+/)
  })

  test('piège de focus : Tab ne sort pas du tiroir (Maj+Tab depuis Fermer boucle vers le dernier élément)', async ({
    page,
  }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    await shell.openDrawer()
    await page.keyboard.press('Shift+Tab')
    await expect(page.locator('[data-cp-sidebar]').locator(':focus')).toHaveCount(1)
  })

  test('onglets : clic change la page et aria-current, 4 onglets par défaut', async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    await expect(shell.tabbar.getByRole('button')).toHaveCount(4)
    await shell.tab('À valider').click()
    await expect(shell.log).toHaveText('nav:approvals')
    await expect(shell.tab('À valider')).toHaveAttribute('aria-current', 'page')
    await expect(page).toHaveScreenshot('app-shell-tabs.png')
  })

  test('zones tactiles >= 44px (onglets, bouton menu)', async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto()
    const tab = await shell.tab('Accueil').boundingBox()
    const menu = await shell.openMenuButton.boundingBox()
    expect(tab?.height).toBeGreaterThanOrEqual(44)
    expect(menu?.width).toBeGreaterThanOrEqual(44)
    expect(menu?.height).toBeGreaterThanOrEqual(44)
  })

  test("prefers-reduced-motion : le tiroir s'ouvre sans transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const shell = new AppShellPage(page)
    await shell.goto()
    await expect(page.locator('[data-cp-sidebar]')).toHaveCSS('transition-property', 'none')
    await shell.openDrawer()
  })
})
