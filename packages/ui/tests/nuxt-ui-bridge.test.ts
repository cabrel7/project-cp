import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  colorByName,
  declMap,
  exists,
  isHex6,
  luminance,
  pathOf,
  read,
  rulesWithPrelude,
  topLevelRules,
} from './helpers'

const themeCss = read('../assets/css/theme.css')
const tokensCss = read('../assets/css/tokens.css')
const themeDecls = declMap(rulesWithPrelude(themeCss, '@theme static')[0]?.body ?? '')
const lightDecls = declMap(rulesWithPrelude(tokensCss, ':root')[0]?.body ?? '')
const darkDecls = declMap(rulesWithPrelude(tokensCss, '.dark')[0]?.body ?? '')

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
const SCALES = ['primary', 'secondary', 'success', 'warning', 'error', 'info', 'warm'] as const

const shade = (scale: string, n: number): string | undefined =>
  themeDecls.get(`--color-${scale}-${n}`)?.toLowerCase()

describe('theme.css — échelles Nuxt UI 50-950', () => {
  it('doit définir exactement 7 échelles x 11 nuances, en hexadécimal à 6 chiffres', () => {
    const names = [...themeDecls.keys()].filter((n) =>
      /^--color-(primary|secondary|success|warning|error|info|warm)-\d+$/.test(n),
    )
    expect(names).toHaveLength(SCALES.length * SHADES.length)
    for (const scale of SCALES) {
      for (const n of SHADES) {
        const value = themeDecls.get(`--color-${scale}-${n}`)
        expect(value !== undefined && isHex6(value), `${scale}-${n} = ${value}`).toBe(true)
      }
    }
  })

  it('doit avoir des nuances de plus en plus sombres de 50 à 950 (luminance strictement décroissante)', () => {
    for (const scale of SCALES) {
      const luminances = SHADES.map((n) => luminance(shade(scale, n) as string))
      for (let i = 1; i < luminances.length; i++) {
        expect(
          luminances[i] as number,
          `${scale}-${SHADES[i]} doit être plus sombre que ${scale}-${SHADES[i - 1]}`,
        ).toBeLessThan(luminances[i - 1] as number)
      }
    }
  })

  it('doit avoir des nuances toutes distinctes dans chaque échelle', () => {
    for (const scale of SCALES) {
      const values = SHADES.map((n) => shade(scale, n))
      expect(new Set(values).size, scale).toBe(SHADES.length)
    }
  })

  // [échelle, nuance, jeton, thème] — ancrage sur les valeurs du design system
  const anchors: [string, number, string, 'light' | 'dark'][] = [
    ['primary', 600, 'primary', 'light'],
    ['primary', 400, 'primary', 'dark'],
    ['primary', 500, 'brand-violet', 'light'],
    ['primary', 700, 'primary-hover', 'light'],
    ['primary', 50, 'primary-soft', 'light'],
    ['primary', 900, 'primary-soft', 'dark'],
    ['secondary', 600, 'accent', 'light'],
    ['secondary', 400, 'accent', 'dark'],
    ['secondary', 700, 'accent-text', 'light'],
    ['secondary', 50, 'accent-soft', 'light'],
    ['secondary', 900, 'accent-soft', 'dark'],
    ['success', 600, 'success', 'light'],
    ['success', 400, 'success', 'dark'],
    ['success', 50, 'success-soft', 'light'],
    ['success', 900, 'success-soft', 'dark'],
    ['warning', 600, 'warning', 'light'],
    ['warning', 400, 'warning', 'dark'],
    ['warning', 50, 'warning-soft', 'light'],
    ['warning', 900, 'warning-soft', 'dark'],
    ['error', 600, 'danger', 'light'],
    ['error', 400, 'danger', 'dark'],
    ['error', 50, 'danger-soft', 'light'],
    ['error', 900, 'danger-soft', 'dark'],
    ['info', 600, 'info', 'light'],
    ['info', 400, 'info', 'dark'],
    ['info', 50, 'info-soft', 'light'],
    ['info', 900, 'info-soft', 'dark'],
    ['warm', 100, 'surface-sunken', 'light'],
    ['warm', 200, 'line', 'light'],
    ['warm', 400, 'ink-disabled', 'light'],
    ['warm', 500, 'line-strong', 'light'],
    ['warm', 600, 'ink-muted', 'light'],
    ['warm', 900, 'ink', 'light'],
    ['warm', 800, 'line', 'dark'],
    ['warm', 950, 'canvas', 'dark'],
  ]

  it.each(anchors)(
    'doit ancrer %s-%i sur le jeton %s (%s) de tokens.json',
    (scale, n, name, theme) => {
      expect(shade(scale, n)).toBe(colorByName(name).value[theme].toLowerCase())
    },
  )
})

describe('theme.css — pont --ui-* (Nuxt UI → jetons --cp-*)', () => {
  // Le pont est le seul bloc de premier niveau `:root` qui déclare des --ui-*.
  const bridgeRules = topLevelRules(themeCss).filter(
    (r) => r.prelude === ':root' && /--ui-/.test(r.body),
  )
  const bridge = declMap(bridgeRules[0]?.body ?? '')

  it('doit exister en un seul bloc :root hors @layer (sinon .dark de Nuxt UI, plus spécifique, l’emporte)', () => {
    expect(bridgeRules).toHaveLength(1)
  })

  it('doit ne référencer que des jetons --cp-* existants (ou le rayon --radius-md)', () => {
    expect(bridge.size).toBeGreaterThan(0)
    for (const [name, value] of bridge) {
      expect(name.startsWith('--ui-'), name).toBe(true)
      const match = /^var\((--[a-z0-9-]+)\)$/.exec(value)
      expect(match, `${name} = ${value}`).not.toBeNull()
      const target = match?.[1] as string
      if (target.startsWith('--cp-')) {
        // cible thématique : doit exister en clair ET en sombre, sinon le mode sombre casse
        expect(lightDecls.has(target), `${name} -> ${target} (clair)`).toBe(true)
        expect(darkDecls.has(target), `${name} -> ${target} (sombre)`).toBe(true)
      } else {
        expect(target, name).toBe('--radius-md')
      }
    }
  })

  it('doit relier les couleurs sémantiques aux bons jetons (primary, error = danger, bg, text, border)', () => {
    const expected: Record<string, string> = {
      '--ui-primary': 'var(--cp-primary)',
      '--ui-secondary': 'var(--cp-accent)',
      '--ui-success': 'var(--cp-success)',
      '--ui-warning': 'var(--cp-warning)',
      '--ui-error': 'var(--cp-danger)',
      '--ui-info': 'var(--cp-info)',
      '--ui-bg': 'var(--cp-canvas)',
      '--ui-bg-elevated': 'var(--cp-surface-raised)',
      '--ui-bg-muted': 'var(--cp-surface-sunken)',
      '--ui-bg-inverted': 'var(--cp-ink)',
      '--ui-border': 'var(--cp-line)',
      '--ui-border-accented': 'var(--cp-line-strong)',
      '--ui-text': 'var(--cp-ink)',
      '--ui-text-muted': 'var(--cp-ink-muted)',
      '--ui-text-dimmed': 'var(--cp-ink-disabled)',
      '--ui-radius': 'var(--radius-md)',
    }
    for (const [name, value] of Object.entries(expected)) {
      expect(bridge.get(name), name).toBe(value)
    }
  })

  it('doit reprendre le rayon par défaut du design system (radius-md = 10 px)', () => {
    expect(themeDecls.get('--radius-md')).toBe('10px')
    expect(bridge.get('--ui-radius')).toBe('var(--radius-md)')
  })

  it('doit être cohérent avec les échelles : --ui-primary = primary-600 (clair) / primary-400 (sombre)', () => {
    // Nuxt UI prendrait primary-500 (clair) : le pont existe précisément pour éviter cet écart.
    expect(lightDecls.get('--cp-primary')?.toLowerCase()).toBe(shade('primary', 600))
    expect(darkDecls.get('--cp-primary')?.toLowerCase()).toBe(shade('primary', 400))
    expect(shade('primary', 500)).not.toBe(shade('primary', 600))
  })

  const nuxtUiCss = '../node_modules/@nuxt/ui/dist/runtime/index.css'
  it.skipIf(!exists(nuxtUiCss))(
    'doit surcharger toutes les variables de surface, de texte et de bordure définies par Nuxt UI (clair et sombre)',
    () => {
      const source = readFileSync(pathOf(nuxtUiCss), 'utf8')
      const semantic = new Set(
        [...source.matchAll(/(--ui-(?:text|bg|border)[a-z-]*)\s*:/g)].map((m) => m[1] as string),
      )
      expect(semantic.size).toBeGreaterThanOrEqual(15)
      const missing = [...semantic].filter((name) => !bridge.has(name))
      expect(missing).toEqual([])
    },
  )
})

describe('app.config.ts — alias de couleurs Nuxt UI', () => {
  const load = async (): Promise<{ ui: { colors: Record<string, string> } }> => {
    vi.stubGlobal('defineAppConfig', (config: unknown) => config)
    const module = (await import('../app/app.config')) as {
      default: { ui: { colors: Record<string, string> } }
    }
    return module.default
  }

  it('doit déclarer exactement les 7 alias requis, chacun pointant sur son échelle (neutral -> warm)', async () => {
    const { ui } = await load()
    expect(ui.colors).toEqual({
      primary: 'primary',
      secondary: 'secondary',
      neutral: 'warm', // Nuxt UI lit --color-old-neutral-* pour la valeur littérale "neutral"
      success: 'success',
      warning: 'warning',
      error: 'error',
      info: 'info',
    })
    // toutes les échelles référencées sont celles de theme.css
    expect(new Set(Object.values(ui.colors))).toEqual(new Set(SCALES))
  })

  it('doit n’utiliser que des échelles entièrement définies (11 nuances) dans theme.css', async () => {
    const { ui } = await load()
    for (const scale of Object.values(ui.colors)) {
      for (const n of SHADES) {
        expect(themeDecls.has(`--color-${scale}-${n}`), `${scale}-${n}`).toBe(true)
      }
    }
  })

  it('doit avoir une variable --ui-<alias> dans le pont pour chaque alias sauf neutral', async () => {
    const { ui } = await load()
    const bridge = declMap(
      topLevelRules(themeCss).find((r) => r.prelude === ':root' && /--ui-/.test(r.body))?.body ??
        '',
    )
    for (const alias of Object.keys(ui.colors).filter((a) => a !== 'neutral')) {
      expect(bridge.has(`--ui-${alias}`), alias).toBe(true)
    }
  })

  it('ne doit contenir aucune couleur en dur ni classe de palette Tailwind par défaut', () => {
    const source = read('../app/app.config.ts')
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/)
  })
})
