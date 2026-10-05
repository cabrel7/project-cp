import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { gotoHydrated } from '../helpers'

const PAGES: ReadonlyArray<{ name: string; path: string }> = [
  { name: 'index', path: '/' },
  { name: 'AppShell', path: '/app' },
  { name: 'AdminShell', path: '/admin' },
  { name: 'G1 liste', path: '/gabarit-list' },
  { name: 'G2 détail', path: '/gabarit-detail' },
  { name: 'G3 assistant (wizard)', path: '/gabarit-wizard' },
  { name: 'G4 tableau de bord', path: '/gabarit-dashboard' },
  { name: 'G5 réglages', path: '/gabarit-settings' },
  { name: 'G6 conversation', path: '/gabarit-conversation' },
  { name: 'G7 éditeur', path: '/gabarit-editor' },
  { name: 'G8 authentification', path: '/gabarit-auth' },
  { name: 'catalogue', path: '/catalog' },
]

test.describe('Accessibilité WCAG 2.0 AA', () => {
  test.beforeEach((_fixtures, info) =>
    test.skip(info.project.name !== 'desktop-light', 'a11y on desktop-light only'),
  )

  for (const { name, path } of PAGES) {
    test(`${name} (${path}) sans violation axe`, async ({ page }) => {
      await gotoHydrated(page, path)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(results.violations).toEqual([])
    })
  }
})
