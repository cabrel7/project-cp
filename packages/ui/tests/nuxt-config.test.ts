// @vitest-environment node
import { basename } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { declMap, exists, pathOf, read, rulesWithPrelude, tokens } from './helpers'

interface NuxtConfig {
  compatibilityDate?: string
  modules?: string[]
  extends?: string[]
  css?: string[]
  ui?: { fonts?: boolean }
  icon?: { serverBundle?: string; collections?: string[] }
  colorMode?: { classSuffix?: string; preference?: string; fallback?: string }
  devServer?: { port?: number }
  typescript?: {
    strict?: boolean
    tsConfig?: { compilerOptions?: Record<string, unknown> }
  }
}

const loadConfig = async (path: string): Promise<NuxtConfig> => {
  vi.stubGlobal('defineNuxtConfig', (config: unknown) => config)
  const module = (await import(/* @vite-ignore */ pathOf(path))) as { default: NuxtConfig }
  return module.default
}

const themeCss = read('../assets/css/theme.css')
const uiPackage = JSON.parse(read('../package.json')) as {
  main: string
  dependencies: Record<string, string>
}

describe('packages/ui/nuxt.config.ts — layer Nuxt', () => {
  it('doit charger uniquement le module @nuxt/ui (pas @nuxt/fonts, qui télécharge à la compilation)', async () => {
    const config = await loadConfig('../nuxt.config.ts')
    expect(config.modules).toEqual(['@nuxt/ui', '@nuxtjs/i18n'])
  })

  it('doit déclarer theme.css comme seule feuille de style globale, en chemin absolu existant', async () => {
    const config = await loadConfig('../nuxt.config.ts')
    expect(config.css).toHaveLength(1)
    const [entry] = config.css as [string]
    expect(entry.startsWith('/')).toBe(true) // les entrées css sont résolues comme des ids de module
    expect(basename(entry)).toBe('theme.css')
    expect(entry).toBe(pathOf('../assets/css/theme.css'))
    expect(exists('../assets/css/theme.css')).toBe(true)
  })

  it('doit désactiver @nuxt/fonts de Nuxt UI (les polices viennent de @fontsource)', async () => {
    const config = await loadConfig('../nuxt.config.ts')
    expect(config.ui?.fonts).toBe(false)
  })

  it('doit piloter le mode sombre par la classe .dark (classSuffix vide), préférence système, repli clair', async () => {
    const config = await loadConfig('../nuxt.config.ts')
    expect(config.colorMode).toEqual({ classSuffix: '', preference: 'system', fallback: 'light' })
    // classSuffix '' => classe `dark` : c'est le sélecteur des jetons
    expect(rulesWithPrelude(read('../assets/css/tokens.css'), '.dark')).toHaveLength(1)
  })

  it('doit limiter les icônes à la collection Lucide, embarquée localement', async () => {
    const config = await loadConfig('../nuxt.config.ts')
    expect(config.icon).toEqual({ serverBundle: 'local', collections: ['lucide'] })
  })

  it('doit avoir une compatibilityDate ISO valide, identique dans le layer et dans les deux applications', async () => {
    const layer = await loadConfig('../nuxt.config.ts')
    const web = await loadConfig('../../../apps/web/nuxt.config.ts')
    const admin = await loadConfig('../../../apps/admin/nuxt.config.ts')
    expect(layer.compatibilityDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Number.isNaN(Date.parse(layer.compatibilityDate as string))).toBe(false)
    expect(web.compatibilityDate).toBe(layer.compatibilityDate)
    expect(admin.compatibilityDate).toBe(layer.compatibilityDate)
  })

  it('doit être résolu comme layer par le paquet (main = nuxt.config.ts existant)', () => {
    expect(uiPackage.main).toBe('./nuxt.config.ts')
    expect(exists('../nuxt.config.ts')).toBe(true)
    expect(exists('../app/app.config.ts')).toBe(true)
  })
})

describe('apps/web et apps/admin — héritage du layer @cp/ui', () => {
  const apps = [
    { name: 'web', path: '../../../apps/web', port: 3000 },
    { name: 'admin', path: '../../../apps/admin', port: 3001 },
  ]

  it.each(apps)(
    'doit étendre exactement ["@cp/ui"] et déclarer la dépendance workspace ($name)',
    async ({ path }) => {
      const config = await loadConfig(`${path}/nuxt.config.ts`)
      expect(config.extends).toEqual(['@cp/ui'])
      const pkg = JSON.parse(read(`${path}/package.json`)) as {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
      const dep = pkg.dependencies?.['@cp/ui'] ?? pkg.devDependencies?.['@cp/ui']
      expect(dep).toBe('workspace:*')
    },
  )

  it.each(apps)(
    'doit ne pas redéfinir le thème (modules, css, colorMode) localement ($name)',
    async ({ path }) => {
      const config = await loadConfig(`${path}/nuxt.config.ts`)
      expect(config.modules).toBeUndefined()
      expect(config.css).toBeUndefined()
      expect(config.colorMode).toBeUndefined()
      expect(config.ui).toBeUndefined()
    },
  )

  it.each(apps)('doit garder TypeScript strict ($name)', async ({ path }) => {
    const config = await loadConfig(`${path}/nuxt.config.ts`)
    expect(config.typescript?.strict).toBe(true)
    expect(config.typescript?.tsConfig?.compilerOptions?.noUncheckedIndexedAccess).toBe(true)
  })

  it('doit utiliser des ports de développement distincts (3000 web, 3001 admin)', async () => {
    const ports: number[] = []
    for (const app of apps) {
      const config = await loadConfig(`${app.path}/nuxt.config.ts`)
      expect(config.devServer?.port, app.name).toBe(app.port)
      ports.push(config.devServer?.port as number)
    }
    expect(new Set(ports).size).toBe(ports.length)
  })

  it.each(apps)(
    'doit envelopper l’application dans <UApp> (requis par Nuxt UI : toasts, tooltips, modales) ($name)',
    ({ path }) => {
      expect(read(`${path}/app/app.vue`)).toMatch(/<UApp>[\s\S]*<\/UApp>/)
    },
  )
})

describe('polices @fontsource', () => {
  const imports = [
    ...themeCss.matchAll(/@import\s+"@fontsource\/([a-z-]+)\/latin-(\d+)\.css";/g),
  ].map((m) => ({ pkg: m[1] as string, weight: Number(m[2]) }))
  const weightsOf = (pkg: string): number[] =>
    imports.filter((i) => i.pkg === pkg).map((i) => i.weight)

  it('doit déclarer en dépendance chaque paquet @fontsource importé par theme.css', () => {
    expect(imports.length).toBeGreaterThan(0)
    for (const { pkg } of imports) {
      expect(uiPackage.dependencies[`@fontsource/${pkg}`], pkg).toBeDefined()
    }
  })

  it('doit importer des fichiers de police qui existent réellement dans node_modules', () => {
    for (const { pkg, weight } of imports) {
      expect(
        exists(`../node_modules/@fontsource/${pkg}/latin-${weight}.css`),
        `${pkg} ${weight}`,
      ).toBe(true)
    }
  })

  it('doit couvrir toutes les graisses de l’échelle typographique (Titres 600/700, interface 400/500/600, code 400)', () => {
    const styles = tokens.type.groups.flatMap((g) => g.styles.map((s) => ({ ...g, ...s })))
    const mono = new Set(['code', 'code-sm'])
    const need = (pred: (s: (typeof styles)[number]) => boolean): number[] => [
      ...new Set(styles.filter(pred).map((s) => s.fontWeight)),
    ]
    for (const w of need((s) => s.family === 'display')) {
      expect(weightsOf('plus-jakarta-sans'), `display ${w}`).toContain(w)
    }
    for (const w of need((s) => s.family === 'sans' && !mono.has(s.name))) {
      expect(weightsOf('geist'), `sans ${w}`).toContain(w)
    }
    for (const w of need((s) => mono.has(s.name))) {
      expect(weightsOf('geist-mono'), `mono ${w}`).toContain(w)
    }
  })

  it('doit fournir des @font-face dont le nom de famille correspond au premier nom de tokens.json', () => {
    const families: [string, string][] = [
      ['plus-jakarta-sans', 'display'],
      ['geist', 'sans'],
      ['geist-mono', 'mono'],
    ]
    for (const [pkg, key] of families) {
      const expected = (tokens.type.families[key] as string).split(',')[0]?.replace(/"/g, '').trim()
      const weight = weightsOf(pkg)[0]
      const css = read(`../node_modules/@fontsource/${pkg}/latin-${weight}.css`)
      expect(css, pkg).toMatch(new RegExp(`font-family:\\s*['"]?${expected}['"]?`))
    }
  })

  it('doit utiliser font-display: swap (pas de texte invisible au chargement)', () => {
    for (const { pkg, weight } of imports) {
      expect(read(`../node_modules/@fontsource/${pkg}/latin-${weight}.css`)).toMatch(
        /font-display:\s*swap/,
      )
    }
  })

  it('doit garder les valeurs --cp-font-* alignées sur tokens.json (la pile de repli reste système)', () => {
    const shared = declMap(
      rulesWithPrelude(read('../assets/css/tokens.css'), ':root')[1]?.body ?? '',
    )
    for (const [name, value] of Object.entries(tokens.type.families)) {
      expect(shared.get(`--cp-font-${name}`)).toBe(value)
      expect(value).toMatch(/(sans-serif|monospace)$/)
    }
  })
})

describe('P1.1 — livrables du plan (08-plan-construction)', () => {
  it('doit exposer les tailles de contrôle 32 / 40 / 48 px aux composants via tokens.css (importé par theme.css)', () => {
    const tokensCss = read('../assets/css/tokens.css')
    for (const size of ['sm', 'md', 'lg']) {
      expect(tokensCss, `control-${size}`).toMatch(new RegExp(`--cp-control-${size}`))
    }
    expect(themeCss).toContain('@import "./tokens.css"')
  })

  it('doit avoir la directive Tailwind activée dans la configuration Biome (sinon @theme est une erreur de lint)', () => {
    const biome = JSON.parse(read('../../../biome.json')) as {
      css?: { parser?: { tailwindDirectives?: boolean } }
    }
    expect(biome.css?.parser?.tailwindDirectives).toBe(true)
  })
})
