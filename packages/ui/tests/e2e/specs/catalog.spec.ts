import { expect, test } from '@playwright/test'
import { gotoHydrated } from '../helpers'

// Régression visuelle du catalogue de composants (docs/design-system/ — 27 composants).
const SECTIONS = [
  'button',
  'fields',
  'status-badge',
  'alert',
  'risk-tag',
  'credit-meter',
  'approval-card',
] as const

test.describe('Catalogue — pleine page', () => {
  test('capture pleine page', async ({ page }) => {
    await gotoHydrated(page, '/catalog')
    await expect(page.locator('[data-page="catalog"]')).toBeVisible()
    await expect(page).toHaveScreenshot('catalog-full.png', { fullPage: true })
  })
})

test.describe('Catalogue — sections', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHydrated(page, '/catalog')
  })

  for (const section of SECTIONS) {
    test(`section ${section}`, async ({ page }) => {
      const locator = page.locator(`[data-section="${section}"]`)
      await locator.scrollIntoViewIfNeeded()
      await expect(locator).toBeVisible()
      await expect(locator).toHaveScreenshot(`catalog-${section}.png`)
    })
  }
})
