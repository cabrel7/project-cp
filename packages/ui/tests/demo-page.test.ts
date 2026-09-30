import { describe, expect, it } from 'vitest'
import { contrast, declMap, read, rulesWithPrelude, tokens } from './helpers'

const page = read('../../../apps/web/app/pages/index.vue')
const appVues = [
  ['web', read('../../../apps/web/app/app.vue')],
  ['admin', read('../../../apps/admin/app/app.vue')],
] as const
const themeCss = read('../assets/css/theme.css')
const tokensCss = read('../assets/css/tokens.css')
const themeDecls = declMap(rulesWithPrelude(themeCss, '@theme static')[0]?.body ?? '')
const light = declMap(rulesWithPrelude(tokensCss, ':root')[0]?.body ?? '')
const dark = declMap(rulesWithPrelude(tokensCss, '.dark')[0]?.body ?? '')

const tokenNames = new Set(tokens.color.tokens.map((t) => t.name))
const UTILITIES =
  'bg|text|border|divide|ring|outline|fill|stroke|shadow|decoration|accent|caret|from|via|to'

interface Swatch {
  name: string
  swatch: string
  text: string
}
const swatches: Swatch[] = [
  ...page.matchAll(/\{\s*name:\s*'([^']+)',\s*swatch:\s*'([^']+)',\s*text:\s*'([^']+)'\s*\}/g),
].map((m) => ({ name: m[1] as string, swatch: m[2] as string, text: m[3] as string }))

const typeSamples = [...page.matchAll(/name:\s*'([^']+)',\s*classes:\s*'([^']+)'/g)].map((m) => ({
  name: m[1] as string,
  classes: m[2] as string,
}))

describe('page de démonstration — Invariant 9 (aucune couleur ni taille en dur)', () => {
  it('doit ne contenir aucun littéral de couleur (hex, rgb, hsl, oklch)', () => {
    expect(page).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![-\w])/)
    expect(page).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\(/)
  })

  it('doit ne contenir aucun style en ligne ni bloc <style>', () => {
    expect(page).not.toMatch(/\sstyle\s*=/)
    expect(page).not.toMatch(/:style\s*=/)
    expect(page).not.toMatch(/<style[\s>]/)
  })

  it('doit n’employer aucune classe de la palette Tailwind par défaut (bg-red-500, text-gray-700, border-slate-200...)', () => {
    const palette =
      'slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
    expect(page).not.toMatch(new RegExp(`\\b(?:${UTILITIES})-(?:${palette})-\\d{2,3}\\b`))
  })

  it('doit n’employer ni bg-white / text-black... ni les échelles Nuxt UI brutes (primary-500, neutral-200) : uniquement les classes cp-*', () => {
    expect(page).not.toMatch(new RegExp(`\\b(?:${UTILITIES})-(?:white|black)\\b`))
    expect(page).not.toMatch(
      new RegExp(
        `\\b(?:${UTILITIES})-(?:primary|secondary|success|warning|error|info|neutral|warm)-\\d{2,3}\\b`,
      ),
    )
  })

  it('doit n’employer aucune valeur arbitraire en dur dans les classes ([#fff], [13px], [1.5rem])', () => {
    expect(page).not.toMatch(/-\[[^\]]*(?:#|\d+(?:px|rem|em)|rgb|hsl)[^\]]*\]/)
  })

  it('doit n’utiliser que des classes de couleur cp-* qui existent dans le thème et dans tokens.json', () => {
    const used = new Set(
      [...page.matchAll(new RegExp(`\\b(?:${UTILITIES})-cp-([a-z0-9-]+)`, 'g'))].map(
        (m) => m[1] as string,
      ),
    )
    expect(used.size).toBeGreaterThan(10)
    for (const name of used) {
      expect(tokenNames.has(name), `token ${name} inconnu de tokens.json`).toBe(true)
      expect(themeDecls.has(`--color-cp-${name}`), `--color-cp-${name} absent de @theme`).toBe(true)
    }
  })

  it('doit référencer les largeurs par variable de thème (max-w-(--width-content-max)) et non par pixel', () => {
    expect(page).toContain('max-w-(--width-content-max)')
    for (const [, name] of page.matchAll(/\(--([a-z0-9-]+)\)/g)) {
      expect(themeDecls.has(`--${name}`), `--${name}`).toBe(true)
    }
  })

  it.each(appVues)('ne doit contenir aucune couleur en dur dans app.vue (%s)', (_name, source) => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/)
  })
})

describe('page de démonstration — fidélité au design system', () => {
  it('doit présenter des pastilles dont le nom correspond à la classe bg-cp-* et à un jeton réel', () => {
    expect(swatches.length).toBeGreaterThanOrEqual(25)
    for (const s of swatches) {
      expect(s.swatch, s.name).toBe(`bg-cp-${s.name}`)
      expect(tokenNames.has(s.name), s.name).toBe(true)
      expect(s.text, s.name).toMatch(/^text-cp-[a-z0-9-]+$/)
    }
  })

  it('doit présenter chaque pastille une seule fois', () => {
    const names = swatches.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('doit présenter toutes les couleurs sémantiques (sauf scrim, focus-ring, chart-grid, on-* et *-text : voile, anneau, grille ou couleurs de texte)', () => {
    const shown = new Set(swatches.map((s) => s.name))
    const expected = tokens.color.tokens
      .map((t) => t.name)
      .filter(
        (n) =>
          n !== 'scrim' &&
          n !== 'chart-grid' &&
          n !== 'focus-ring' &&
          !n.startsWith('on-') &&
          !n.endsWith('-text'),
      )
    expect(expected.filter((n) => !shown.has(n))).toEqual([])
  })

  it.each(['light', 'dark'] as const)(
    'doit garder le libellé de chaque pastille lisible (%s)',
    (theme) => {
      const values = theme === 'light' ? light : dark
      const failures: string[] = []
      const chart = new Set(['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6'])
      const decorative = new Set([...chart, 'brand-violet', 'line-strong'])
      for (const s of swatches) {
        const bg = values.get(`--cp-${s.swatch.replace('bg-cp-', '')}`) as string
        const fg = values.get(`--cp-${s.text.replace('text-cp-', '')}`) as string
        const ratio = contrast(fg, bg)
        const min = chart.has(s.name) ? 2.0 : decorative.has(s.name) ? 3.0 : 4.5
        if (ratio < min)
          failures.push(`${s.name}: ${s.text} sur ${s.swatch} = ${ratio.toFixed(2)} (min ${min})`)
      }
      expect(failures).toEqual([])
    },
  )

  it('doit montrer tous les styles typographiques du design system avec la bonne classe text-* et la bonne famille', () => {
    const groups = new Map(
      tokens.type.groups.flatMap((g) => g.styles.map((s) => [s.name, g.family] as const)),
    )
    expect(typeSamples.map((t) => t.name).sort()).toEqual([...groups.keys()].sort())
    for (const sample of typeSamples) {
      expect(sample.classes.split(' '), sample.name).toContain(`text-${sample.name}`)
      expect(themeDecls.has(`--text-${sample.name}`), sample.name).toBe(true)
      if (groups.get(sample.name) === 'display') {
        expect(sample.classes, sample.name).toContain('font-display')
      }
    }
  })

  it('doit utiliser des chiffres tabulaires pour le KPI (alignement des montants en crédits)', () => {
    const kpi = typeSamples.find((t) => t.name === 'kpi')
    expect(kpi?.classes.split(' ')).toContain('tabular-nums')
    expect(themeCss).toMatch(/\.tabular-nums\s*\{\s*font-variant-numeric:\s*tabular-nums;/)
  })
})

describe('page de démonstration — accessibilité et mode sombre', () => {
  it('doit fournir un interrupteur de mode sombre avec un nom accessible', () => {
    expect(page).toMatch(/<USwitch[^>]*aria-label="[^"]+"/)
  })

  it('doit piloter le mode via useColorMode().preference (light / dark), pas en manipulant le DOM', () => {
    expect(page).toMatch(/useColorMode\(\)/)
    expect(page).toMatch(/colorMode\.preference\s*=\s*value \? 'dark' : 'light'/)
    expect(page).not.toMatch(/classList\.(add|toggle|remove)|document\./)
  })

  it('doit garder une cible tactile d’au moins 44 px sur la ligne de l’interrupteur (min-h-11)', () => {
    expect(page).toMatch(/<label[^>]*min-h-11/)
  })

  it('doit désactiver visuellement un bouton par l’attribut disabled (pas par une couleur)', () => {
    expect(page).toMatch(/<UButton[^>]*label="Désactivé"[^>]*disabled/)
  })

  it('doit être responsive mobile-first (grilles 2 colonnes par défaut, extensions md: / lg:)', () => {
    expect(page).toMatch(/grid-cols-2[^"]*md:grid-cols-4[^"]*lg:grid-cols-6/)
  })
})

describe('page de démonstration — Invariant 9 (textes i18n FR/EN)', () => {
  it.todo(
    'doit passer tous les textes visibles par i18n FR/EN — DETTE : la page de démo contient du français en dur et @nuxtjs/i18n n’est pas encore installé (lot ultérieur)',
  )
})
