import { describe, expect, it } from 'vitest'
import {
  declarations,
  declMap,
  isHex6,
  read,
  rulesWithPrelude,
  stripComments,
  tokens,
  topLevelRules,
} from './helpers'

const tokensCss = read('../assets/css/tokens.css')
const themeCss = read('../assets/css/theme.css')

const lightBlock = rulesWithPrelude(tokensCss, ':root')[0]?.body ?? ''
const sharedBlock = rulesWithPrelude(tokensCss, ':root')[1]?.body ?? ''
const darkBlock = rulesWithPrelude(tokensCss, '.dark')[0]?.body ?? ''
const themeBlock = rulesWithPrelude(themeCss, '@theme static')[0]?.body ?? ''

const themedNames = [...tokens.color.tokens, ...tokens.shadow.tokens].map((t) => t.name)

describe('tokens.css — cohérence clair / sombre', () => {
  it('doit trouver les trois blocs attendus (:root thématique, .dark, :root partagé)', () => {
    expect(rulesWithPrelude(tokensCss, ':root')).toHaveLength(2)
    expect(rulesWithPrelude(tokensCss, '.dark')).toHaveLength(1)
    expect(declarations(lightBlock).length).toBeGreaterThan(0)
  })

  it('doit déclarer exactement les mêmes variables dans :root et dans .dark', () => {
    const light = [...declMap(lightBlock).keys()].sort()
    const dark = [...declMap(darkBlock).keys()].sort()
    expect(dark).toEqual(light)
  })

  it('doit ne déclarer que des jetons présents dans tokens.json (aucun jeton orphelin)', () => {
    const expected = themedNames.map((n) => `--cp-${n}`).sort()
    expect([...declMap(lightBlock).keys()].sort()).toEqual(expected)
    expect([...declMap(darkBlock).keys()].sort()).toEqual(expected)
  })

  it('doit ne déclarer aucune variable deux fois dans un même bloc', () => {
    for (const [label, block] of [
      ['light', lightBlock],
      ['dark', darkBlock],
      ['shared', sharedBlock],
    ] as const) {
      const names = declarations(block).map((d) => d.name)
      const duplicates = names.filter((n, i) => names.indexOf(n) !== i)
      expect(duplicates, label).toEqual([])
    }
  })

  it('doit utiliser le préfixe --cp- pour toutes les variables de tokens.css', () => {
    const all = declarations(stripComments(tokensCss))
    expect(all.length).toBeGreaterThan(0)
    for (const { name } of all) {
      expect(name.startsWith('--cp-'), name).toBe(true)
    }
  })

  it('doit exprimer chaque couleur en hexadécimal à 6 chiffres ou en rgba() (scrim)', () => {
    for (const token of tokens.color.tokens) {
      for (const theme of ['light', 'dark'] as const) {
        const value = declMap(theme === 'light' ? lightBlock : darkBlock).get(`--cp-${token.name}`)
        expect(
          value !== undefined && (isHex6(value) || /^rgba\(\s*[\d.\s,]+\)$/.test(value)),
          `${token.name} (${theme}) = ${value}`,
        ).toBe(true)
      }
    }
  })

  it('doit avoir un jeton sombre différent du clair pour les surfaces et le texte (le thème sombre existe vraiment)', () => {
    const light = declMap(lightBlock)
    const dark = declMap(darkBlock)
    for (const name of ['canvas', 'surface', 'ink', 'ink-muted', 'primary', 'danger', 'line']) {
      expect(dark.get(`--cp-${name}`), name).not.toBe(light.get(`--cp-${name}`))
    }
  })

  it('doit piloter le mode sombre par la classe .dark seulement (pas de media query ni data-theme)', () => {
    // Nuxt UI (@variant dark) et colorMode.classSuffix = '' reposent sur la classe .dark
    expect(stripComments(tokensCss)).not.toMatch(/prefers-color-scheme/)
    expect(stripComments(themeCss)).not.toMatch(/prefers-color-scheme/)
    expect(tokensCss).not.toContain('data-theme')
    expect(tokensCss).not.toMatch(/\.dark-mode|\.theme-dark/)
  })

  it('doit avoir une grille d’espacement de 4 px : cp-space-N = N x 4 px et --spacing = cp-space-1', () => {
    const shared = declMap(sharedBlock)
    for (const token of tokens.spacing.tokens) {
      const n = Number(token.name.replace('space-', ''))
      expect(shared.get(`--cp-${token.name}`), token.name).toBe(`${n * 4}px`)
    }
    expect(declMap(themeBlock).get('--spacing')).toBe(shared.get('--cp-space-1'))
  })
})

describe('theme.css — cohérence avec tokens.json et tokens.css', () => {
  const themeDecls = declMap(themeBlock)

  it('doit avoir exactement un bloc @theme static', () => {
    expect(rulesWithPrelude(themeCss, '@theme static')).toHaveLength(1)
  })

  it('doit exposer exactement un --color-cp-* par jeton de couleur (aucun orphelin, aucun manquant)', () => {
    const exposed = [...themeDecls.keys()]
      .filter((n) => n.startsWith('--color-cp-'))
      .map((n) => n.replace('--color-cp-', ''))
      .sort()
    expect(exposed).toEqual(tokens.color.tokens.map((t) => t.name).sort())
  })

  it('doit exposer les ombres --shadow-* exactement comme les jetons d’ombre', () => {
    const shadows = [...themeDecls.keys()].filter((n) => n.startsWith('--shadow-')).sort()
    expect(shadows).toEqual(tokens.shadow.tokens.map((t) => `--${t.name}`).sort())
    for (const token of tokens.shadow.tokens) {
      expect(themeDecls.get(`--${token.name}`)).toBe(`var(--cp-${token.name})`)
    }
  })

  it('ne doit référencer que des variables --cp-* définies dans tokens.css', () => {
    const defined = new Set([...declMap(lightBlock).keys(), ...declMap(sharedBlock).keys()])
    const referenced = [...stripComments(themeCss).matchAll(/var\((--cp-[a-z0-9-]+)\)/g)].map(
      (m) => m[1] as string,
    )
    expect(referenced.length).toBeGreaterThan(0)
    for (const name of referenced) {
      expect(defined.has(name), name).toBe(true)
    }
  })

  it('ne doit jamais redéfinir une variable --cp-* (source unique = tokens.css)', () => {
    const redefined = declarations(stripComments(themeCss)).filter((d) =>
      d.name.startsWith('--cp-'),
    )
    expect(redefined).toEqual([])
  })

  it('doit reprendre exactement le style typographique de tokens.json (taille, interligne, graisse, crénage)', () => {
    const styles = tokens.type.groups.flatMap((g) => g.styles)
    expect(styles).toHaveLength(12)
    for (const style of styles) {
      const base = `--text-${style.name}`
      expect(themeDecls.get(base), `${style.name} taille`).toBe(style.fontSize)
      expect(themeDecls.get(`${base}--line-height`), `${style.name} interligne`).toBe(
        style.lineHeight,
      )
      expect(themeDecls.get(`${base}--font-weight`), `${style.name} graisse`).toBe(
        String(style.fontWeight),
      )
      if (style.letterSpacing) {
        expect(themeDecls.get(`${base}--letter-spacing`), `${style.name} crénage`).toBe(
          style.letterSpacing,
        )
      }
    }
  })

  it('ne doit définir aucune échelle typographique hors tokens.json', () => {
    const known = new Set(tokens.type.groups.flatMap((g) => g.styles.map((s) => s.name)))
    const sizes = [...themeDecls.keys()]
      .filter((n) => /^--text-(?!.*--)[a-z0-9-]+$/.test(n))
      .map((n) => n.replace('--text-', ''))
    for (const name of sizes) expect(known.has(name), name).toBe(true)
    expect(sizes).toHaveLength(known.size)
  })

  it('doit brancher les familles de polices sur les variables --cp-font-*', () => {
    for (const name of Object.keys(tokens.type.families)) {
      expect(themeDecls.get(`--font-${name}`)).toBe(`var(--cp-font-${name})`)
    }
  })

  it('doit dériver largeurs, rayons, points de rupture et z-index de tokens.json (aucune valeur divergente)', () => {
    const sizeByName = new Map(tokens.size.tokens.map((t) => [t.name, t.value]))
    expect(themeDecls.get('--width-sidebar')).toBe(sizeByName.get('sidebar'))
    expect(themeDecls.get('--width-content-max')).toBe(sizeByName.get('content-max'))
    expect(themeDecls.get('--width-reading-max')).toBe(sizeByName.get('reading-max'))
    for (const token of tokens.radius.tokens) {
      expect(themeDecls.get(`--${token.name}`), token.name).toBe(token.value)
    }
    for (const token of tokens.breakpoint.tokens) {
      expect(themeDecls.get(`--breakpoint-${token.name.replace('bp-', '')}`), token.name).toBe(
        token.value,
      )
    }
    for (const token of tokens.zIndex.tokens) {
      expect(themeDecls.get(`--${token.name}`), token.name).toBe(token.value)
    }
  })
})

describe('theme.css — Invariant 9 (aucune couleur en dur hors échelles @theme)', () => {
  const COLOR_LITERAL =
    /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(|\b(?:white|black|red|green|blue|gray|grey|orange|yellow|purple|pink)\b/

  it('ne doit contenir aucun littéral de couleur en dehors du bloc @theme', () => {
    const outside = topLevelRules(themeCss).filter((r) => r.prelude !== '@theme static')
    expect(outside.length).toBeGreaterThan(0)
    for (const rule of outside) {
      expect(rule.body, rule.prelude).not.toMatch(COLOR_LITERAL)
    }
  })

  it('ne doit utiliser que des littéraux hexadécimaux à 6 chiffres dans @theme, et seulement pour les échelles Nuxt UI', () => {
    for (const { name, value } of declarations(themeBlock)) {
      if (COLOR_LITERAL.test(value)) {
        expect(name, `${name} = ${value}`).toMatch(
          /^--color-(primary|secondary|success|warning|error|info|warm)-(50|[1-9]00|950)$/,
        )
        expect(isHex6(value), `${name} = ${value}`).toBe(true)
      }
    }
  })

  it('ne doit pas définir d’échelle de couleur hors des 7 alias Nuxt UI et du préfixe cp-', () => {
    const colorNames = [...declMap(themeBlock).keys()].filter((n) => n.startsWith('--color-'))
    for (const name of colorNames) {
      expect(name, name).toMatch(
        /^--color-(cp-[a-z0-9-]+|(primary|secondary|success|warning|error|info|warm)-(50|[1-9]00|950))$/,
      )
    }
  })

  it('ne doit déclarer aucune couche @layer (le pont --ui-* doit rester hors couche pour battre Nuxt UI)', () => {
    expect(stripComments(themeCss)).not.toMatch(/@layer/)
  })

  it('doit garder un focus clavier visible (jamais outline: none / 0)', () => {
    const css = stripComments(themeCss)
    expect(css).not.toMatch(/outline\s*:\s*(none|0)\b/)
    expect(css).toMatch(/\*:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--cp-focus-ring\);/)
    expect(css).toMatch(/outline-offset:\s*2px;/)
  })
})
