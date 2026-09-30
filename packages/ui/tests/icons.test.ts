import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { read } from './helpers'

const page = read('../../../apps/web/app/pages/index.vue')
const uiPackage = JSON.parse(read('../package.json')) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const require = createRequire(fileURLToPath(import.meta.url))
const lucideJsonPath = ((): string | undefined => {
  try {
    return require.resolve('@iconify-json/lucide/icons.json')
  } catch {
    return undefined
  }
})()

const usedIcons = [...new Set([...page.matchAll(/i-lucide-[a-z0-9-]+/g)].map((m) => m[0]))]

describe('icônes Lucide (nuxt.config : icon.serverBundle = local, collections = [lucide])', () => {
  it('doit utiliser des icônes Lucide dans la page de démonstration', () => {
    expect(usedIcons.length).toBeGreaterThanOrEqual(12)
  })

  it('doit déclarer @iconify-json/lucide en dépendance : sans lui le bundle local est VIDE et les icônes sont chargées depuis api.iconify.design à l’exécution', () => {
    // Constaté : `.nuxt/nuxt-icon-server-bundle.mjs` => `export const collections = {}` et le
    // client (nuxt-icon-client-bundle.mjs) est vide. Hors ligne / sous CSP stricte, aucune icône.
    const declared = {
      ...uiPackage.dependencies,
      ...uiPackage.devDependencies,
    }
    expect(declared['@iconify-json/lucide']).toBeDefined()
  })

  it.skipIf(lucideJsonPath === undefined)(
    'doit n’utiliser que des icônes qui existent dans la collection Lucide',
    () => {
      const collection = JSON.parse(readFileSync(lucideJsonPath as string, 'utf8')) as {
        icons: Record<string, unknown>
        aliases?: Record<string, unknown>
      }
      const known = new Set([
        ...Object.keys(collection.icons),
        ...Object.keys(collection.aliases ?? {}),
      ])
      const missing = usedIcons
        .map((name) => name.replace('i-lucide-', ''))
        .filter((name) => !known.has(name))
      expect(missing).toEqual([])
    },
  )
})
