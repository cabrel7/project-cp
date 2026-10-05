import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

interface ThemedToken {
  name: string
  value: { light: string; dark: string }
}
interface PlainToken {
  name: string
  value: string
}
interface TokensJson {
  color: { tokens: ThemedToken[] }
  shadow: { tokens: ThemedToken[] }
  spacing: { tokens: PlainToken[] }
  radius: { tokens: PlainToken[] }
  size: { tokens: PlainToken[] }
  zIndex: { tokens: PlainToken[] }
  breakpoint: { tokens: PlainToken[] }
  type: { families: Record<string, string> }
}

const tokens = JSON.parse(read('../../../docs/design-system/tokens.json')) as TokensJson
const tokensCss = read('../assets/css/tokens.css')
const themeCss = read('../assets/css/theme.css')

const blockOf = (css: string, selector: string, occurrence = 0): string => {
  const parts = css.split(`${selector} {`)
  const part = parts[occurrence + 1]
  if (part === undefined) throw new Error(`Bloc ${selector} introuvable`)
  return part.slice(0, part.indexOf('\n}'))
}

const norm = (value: string): string => value.replace(/\s+/g, '').toLowerCase()
const declares = (block: string, name: string): boolean =>
  new RegExp(`--cp-${name}:\\s*[^;]+;`).test(block)
const tokenValue = (block: string, name: string): string | undefined =>
  norm(new RegExp(`--cp-${name}:\\s*([^;]+);`).exec(block)?.[1] ?? '')

describe('tokens.css', () => {
  const light = blockOf(tokensCss, ':root', 0)
  const dark = blockOf(tokensCss, '.dark')
  const shared = blockOf(tokensCss, ':root', 1)
  const themed = [...tokens.color.tokens, ...tokens.shadow.tokens]

  it('déclare tous les jetons de couleur et d’ombre en clair avec le préfixe --cp-', () => {
    for (const token of themed) {
      expect(tokenValue(light, token.name), token.name).toBe(norm(token.value.light))
    }
  })

  it('déclare tous les jetons thématiques dans .dark avec la valeur sombre', () => {
    for (const token of themed) {
      expect(tokenValue(dark, token.name), token.name).toBe(norm(token.value.dark))
    }
  })

  it('déclare les jetons non thématiques (espacement, rayons, tailles, z-index, points de rupture)', () => {
    const plain = [
      ...tokens.spacing.tokens,
      ...tokens.radius.tokens,
      ...tokens.size.tokens,
      ...tokens.zIndex.tokens,
      ...tokens.breakpoint.tokens,
    ]
    for (const token of plain) {
      expect(tokenValue(shared, token.name), token.name).toBe(norm(token.value))
    }
  })

  it('déclare les familles de polices', () => {
    for (const [name, value] of Object.entries(tokens.type.families)) {
      expect(tokenValue(shared, `font-${name}`), name).toBe(norm(value))
    }
  })

  it('n’utilise pas data-theme et ne déclare aucune variable sans préfixe --cp-', () => {
    expect(tokensCss).not.toContain('data-theme')
    const declarations = tokensCss.match(/^\s*--[a-z0-9-]+:/gm) ?? []
    const inline = tokensCss.match(/\s--[a-z0-9-]+:/g) ?? []
    for (const decl of [...declarations, ...inline]) {
      expect(decl.trim().startsWith('--cp-'), decl).toBe(true)
    }
  })

  it('ne laisse aucun jeton thématique sans valeur dans .dark', () => {
    for (const token of themed) {
      expect(declares(dark, token.name), token.name).toBe(true)
    }
  })
})

describe('theme.css', () => {
  it('importe tailwindcss, @nuxt/ui et tokens.css', () => {
    expect(themeCss).toContain('@import "tailwindcss";')
    expect(themeCss).toContain('@import "@nuxt/ui";')
    expect(themeCss).toContain('@import "./tokens.css";')
  })

  it('contient un bloc @theme', () => {
    expect(themeCss).toContain('@theme static {')
  })

  it('expose toutes les couleurs sémantiques via var(--cp-*)', () => {
    for (const token of tokens.color.tokens) {
      expect(themeCss, token.name).toContain(`--color-cp-${token.name}: var(--cp-${token.name});`)
    }
  })

  it('définit les échelles 50-950 de chaque couleur Nuxt UI, ancrées sur le design system', () => {
    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
    for (const scale of ['primary', 'secondary', 'success', 'warning', 'error', 'info', 'warm']) {
      for (const shade of shades) {
        expect(themeCss, `${scale}-${shade}`).toMatch(
          new RegExp(`--color-${scale}-${shade}:\\s*#[0-9A-Fa-f]{6};`),
        )
      }
    }
    expect(themeCss).toContain('--color-primary-600: #5b50c8;')
    expect(themeCss).toContain('--color-primary-400: #a69ff2;')
    expect(themeCss).toContain('--color-error-600: #b42335;')
  })

  it('définit les polices, l’échelle typographique et le spacing de 4px', () => {
    expect(themeCss).toContain('--font-display: var(--cp-font-display);')
    expect(themeCss).toContain('--font-sans: var(--cp-font-sans);')
    expect(themeCss).toContain('--font-mono: var(--cp-font-mono);')
    for (const style of [
      'display',
      'heading-1',
      'heading-2',
      'heading-3',
      'body-lg',
      'body',
      'body-sm',
      'label',
      'caption',
      'kpi',
      'code',
      'code-sm',
    ]) {
      expect(themeCss, style).toContain(`--text-${style}:`)
      expect(themeCss, style).toContain(`--text-${style}--line-height:`)
    }
    expect(themeCss).toContain('--spacing: 4px;')
  })

  it('reprend rayons, ombres, points de rupture, z-index et largeurs', () => {
    for (const token of tokens.radius.tokens) {
      expect(themeCss, token.name).toContain(`--${token.name}: ${token.value};`)
    }
    for (const name of ['sm', 'md', 'lg']) {
      expect(themeCss).toContain(`--shadow-${name}: var(--cp-shadow-${name});`)
    }
    for (const token of tokens.breakpoint.tokens) {
      expect(themeCss, token.name).toContain(
        `--breakpoint-${token.name.replace('bp-', '')}: ${token.value};`,
      )
    }
    for (const token of tokens.zIndex.tokens) {
      expect(themeCss, token.name).toContain(`--${token.name}: ${token.value};`)
    }
    expect(themeCss).toContain('--width-sidebar: 256px;')
    expect(themeCss).toContain('--width-content-max: 1200px;')
    expect(themeCss).toContain('--width-reading-max: 720px;')
  })

  it('conserve l’anneau de focus visible', () => {
    expect(themeCss).toContain('outline: 2px solid var(--cp-focus-ring);')
  })
})
