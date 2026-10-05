import type { Page } from '@playwright/test'

export const isMobile = (name: string) => name.startsWith('mobile')
export const isDark = (name: string) => name.endsWith('dark')

/** Navigue puis attend l'hydratation Nuxt (load state). */
export async function gotoHydrated(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'networkidle' })
}
