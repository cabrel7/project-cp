import type { Page } from '@playwright/test'

export const isMobile = (name: string) => name.startsWith('mobile')
export const isDark = (name: string) => name.endsWith('dark')

/** Navigue puis attend l'hydratation (marqueur posé par fixture/app/app.vue : handlers Vue attachés). */
export async function gotoHydrated(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'load' })
  await page.locator('html[data-cp-hydrated]').waitFor({ state: 'attached' })
}

/**
 * Neutralise position:fixed/sticky avant une capture fullPage (desktop : sidebar sticky ;
 * mobile : tiroir fermé, scrim et tabbar masqués).
 * Les éléments fixed (tabbar mobile, sidebar, scrim) restent collés au
 * viewport et se superposent au contenu dans les captures pleine page.
 */
export async function prepareFullPage(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      [data-cp-sidebar],
      [data-cp-topbar],
      [data-cp-scrim],
      nav[class*="fixed"],
      aside[class*="fixed"] {
        position: relative !important;
      }
      nav[class*="sticky"],
      header[class*="sticky"] {
        position: relative !important;
      }
      /* Mobile : tiroir fermé, scrim et tabbar (fixed) ne doivent pas revenir dans le flux
         flex de la coquille (sinon colonnes parasites et débordement horizontal).
         La tabbar est couverte par la capture dédiée app-shell-tabs.png. */
      @media (max-width: 767px) {
        [data-cp-sidebar],
        [data-cp-scrim],
        [data-cp-tabbar] {
          display: none !important;
        }
      }
    `,
  })
}
