import { expect, test } from '@playwright/test'
import { isDark, isMobile } from '../helpers'
import { AdminShellPage } from '../pages/ShellPage'

// Parcours admin : AdminShell + SidebarNav compacte (maquette docs/maquettes/7-navigation/43-NavAdmin.png).

test.describe('AdminShell — thèmes', () => {
  test('les tokens appliquent le bon thème', async ({ page }, info) => {
    const shell = new AdminShellPage(page)
    await shell.goto()
    await expect(page.locator('html')).toHaveClass(
      isDark(info.project.name) ? /\bdark\b/ : /^(?!.*\bdark\b)/,
    )
    const colors = await page.evaluate(() => {
      const probe = (token: string) => {
        const el = document.createElement('span')
        el.style.color = `var(${token})`
        document.body.append(el)
        const value = getComputedStyle(el).color
        el.remove()
        return value
      }
      const stop = document.querySelector('[data-cp-emergency-stop]') as Element
      return {
        dangerToken: probe('--cp-danger'),
        onDangerToken: probe('--cp-on-danger'),
        stopBg: getComputedStyle(stop).backgroundColor,
        stopInk: getComputedStyle(stop).color,
      }
    })
    expect(colors.stopBg).toBe(colors.dangerToken)
    expect(colors.stopInk).toBe(colors.onDangerToken)
  })

  test('capture complète de la coquille admin', async ({ page }) => {
    const shell = new AdminShellPage(page)
    await shell.goto()
    await expect(shell.main).toBeVisible()
    await expect(page).toHaveScreenshot('admin-shell.png')
  })
})

test.describe('AdminShell — desktop', () => {
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixtures arg
  test.beforeEach(({}, testInfo) =>
    test.skip(isMobile(testInfo.project.name), 'desktop uniquement'),
  )

  test('navigation compacte (32px), badge Admin, aria-current, groupes', async ({ page }) => {
    const shell = new AdminShellPage(page)
    await shell.goto()
    await expect(shell.nav).toBeVisible()
    await expect(page.getByText('Admin', { exact: true })).toBeVisible()
    await expect(shell.navItem('Pilotage')).toHaveAttribute('aria-current', 'page')
    for (const g of ['Clients et revenus', 'IA', 'Confiance']) {
      await expect(page.getByText(g, { exact: true })).toBeVisible()
    }
    const box = await shell.navItem('Pilotage').boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(32)
    expect(box?.height).toBeLessThan(40)
    await shell.navItem('Audit').click()
    await expect(shell.navItem('Audit')).toHaveAttribute('aria-current', 'page')
    await expect(shell.log).toHaveText('nav:audit')
  })

  test("arrêt d'urgence : bouton danger libellé, émet emergency-stop", async ({ page }) => {
    const shell = new AdminShellPage(page)
    await shell.goto()
    await expect(shell.emergencyStop).toBeVisible()
    await expect(shell.emergencyStop).toContainText("Arrêt d'urgence")
    await expect(shell.emergencyStop).not.toHaveAttribute('aria-pressed', /.+/)
    await shell.emergencyStop.click()
    await expect(shell.log).toHaveText('emergency-stop')
    await expect(page).toHaveScreenshot('admin-shell-topbar.png', {
      clip: { x: 256, y: 0, width: 1024, height: 64 },
    })
  })

  test("timer de session, badge d'environnement, 2FA et profil administrateur", async ({
    page,
  }) => {
    const shell = new AdminShellPage(page)
    await shell.goto()
    await expect(shell.sessionTimer).toBeVisible()
    await expect(shell.envBadge).toBeVisible()
    await expect(page.getByText('Super-admin')).toBeVisible()
    await expect(page.getByText('Authentification à deux facteurs active')).toBeAttached()
    await shell.profile.click()
    await expect(shell.log).toHaveText('profile')
  })

  test('skip link vers le contenu admin', async ({ page }) => {
    const shell = new AdminShellPage(page)
    await shell.goto()
    await page.keyboard.press('Tab')
    await expect(shell.skipLink).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#cp-admin-main$/)
  })
})

test.describe('AdminShell — mobile 375×667', () => {
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixtures arg
  test.beforeEach(({}, testInfo) =>
    test.skip(!isMobile(testInfo.project.name), 'mobile uniquement'),
  )

  test('aucun débordement horizontal (viewport 375 px respecté)', async ({ page }) => {
    const shell = new AdminShellPage(page)
    await shell.goto()
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    expect(innerWidth).toBe(375)
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
  })

  test('tiroir : ouverture, focus, fermeture Échap / scrim, profil visible dans le tiroir', async ({
    page,
  }) => {
    const shell = new AdminShellPage(page)
    await shell.goto()
    await expect(shell.nav).toBeHidden()
    await shell.openDrawer()
    await expect(shell.closeMenuButton).toBeFocused()
    await expect(page.getByText('Super-admin')).toBeVisible()
    await expect(page).toHaveScreenshot('admin-shell-drawer-open.png')
    await page.keyboard.press('Escape')
    await expect(shell.drawer).toBeHidden()
    await expect(shell.openMenuButton).toBeFocused()
    await shell.openDrawer()
    await page.mouse.click(370, 600)
    await expect(shell.drawer).toBeHidden()
  })

  test("arrêt d'urgence reste accessible (nom accessible) et actionnable, libellé masqué < sm", async ({
    page,
  }) => {
    const shell = new AdminShellPage(page)
    await shell.goto()
    await expect(shell.emergencyStop).toBeVisible()
    await shell.emergencyStop.click()
    await expect(shell.log).toHaveText('emergency-stop')
  })

  test('naviguer depuis le tiroir ferme celui-ci', async ({ page }) => {
    const shell = new AdminShellPage(page)
    await shell.goto()
    await shell.openDrawer()
    await shell.navItem('Clients').click()
    await expect(shell.log).toHaveText('nav:customers')
    await expect(shell.nav).toBeHidden()
  })
})
