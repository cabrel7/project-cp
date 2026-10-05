import { expect, test } from '@playwright/test'
import { gotoHydrated, isDark } from '../helpers'

// Régression visuelle des 8 gabarits (docs/design-system/ — patterns G1 à G8).
// Les 4 projets (desktop/mobile x clair/sombre) produisent chacun leurs captures.
const GABARITS = [
  { id: 'g1-list', path: '/gabarit-list', page: 'gabarit-list' },
  { id: 'g2-detail', path: '/gabarit-detail', page: 'gabarit-detail' },
  { id: 'g3-wizard', path: '/gabarit-wizard', page: 'gabarit-wizard' },
  { id: 'g4-dashboard', path: '/gabarit-dashboard', page: 'gabarit-dashboard' },
  { id: 'g5-settings', path: '/gabarit-settings', page: 'gabarit-settings' },
  { id: 'g6-conversation', path: '/gabarit-conversation', page: 'gabarit-conversation' },
  { id: 'g7-editor', path: '/gabarit-editor', page: 'gabarit-editor' },
  { id: 'g8-auth', path: '/gabarit-auth', page: 'gabarit-auth' },
] as const

test.describe('Gabarits — pleine page', () => {
  for (const g of GABARITS) {
    test(`${g.id} : capture pleine page`, async ({ page }, info) => {
      await gotoHydrated(page, g.path)
      await expect(page.locator(`[data-page="${g.page}"]`)).toBeVisible()
      await expect(page.locator('html')).toHaveClass(
        isDark(info.project.name) ? /\bdark\b/ : /^(?!.*\bdark\b)/,
      )
      await expect(page).toHaveScreenshot(`${g.id}-full.png`, { fullPage: true })
    })
  }
})
