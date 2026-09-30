import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Lit un fichier relatif au dossier `tests/`. */
export const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

export const pathOf = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url))

export const exists = (relative: string): boolean => existsSync(pathOf(relative))

// ---------------------------------------------------------------------------
// Source de vérité : tokens.json
// ---------------------------------------------------------------------------
export interface ThemedToken {
  name: string
  value: { light: string; dark: string }
}
export interface PlainToken {
  name: string
  value: string
}
export interface TypeStyle {
  name: string
  fontSize: string
  lineHeight: string
  fontWeight: number
  letterSpacing?: string
}
export interface TokensJson {
  color: { tokens: ThemedToken[] }
  shadow: { tokens: ThemedToken[] }
  spacing: { tokens: PlainToken[] }
  radius: { tokens: PlainToken[] }
  size: { tokens: PlainToken[] }
  zIndex: { tokens: PlainToken[] }
  breakpoint: { tokens: PlainToken[] }
  type: {
    families: Record<string, string>
    groups: { name: string; family: string; styles: TypeStyle[] }[]
  }
}

export const tokens = JSON.parse(read('../../../docs/design-system/tokens.json')) as TokensJson

export const colorByName = (name: string): ThemedToken => {
  const token = tokens.color.tokens.find((t) => t.name === name)
  if (!token) throw new Error(`Jeton de couleur inconnu : ${name}`)
  return token
}

// ---------------------------------------------------------------------------
// Mini-analyseur CSS (commentaires retirés, blocs de premier niveau, déclarations)
// ---------------------------------------------------------------------------
export const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '')

export interface Rule {
  prelude: string
  body: string
}

/** Règles de niveau 0 (le contenu d'un `@layer x { ... }` reste dans `body` de l'at-rule). */
export const topLevelRules = (css: string): Rule[] => {
  const source = stripComments(css)
  const rules: Rule[] = []
  let depth = 0
  let start = 0
  let bodyStart = 0
  let prelude = ''
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '{') {
      if (depth === 0) {
        prelude = source.slice(start, i).trim()
        bodyStart = i + 1
      }
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) {
        rules.push({ prelude, body: source.slice(bodyStart, i) })
        start = i + 1
      }
    } else if (char === ';' && depth === 0) {
      start = i + 1 // @import ...;
    }
  }
  return rules
}

export interface Declaration {
  name: string
  value: string
}

export const declarations = (body: string): Declaration[] =>
  [...body.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => ({
    name: m[1] as string,
    value: (m[2] as string).trim(),
  }))

export const declMap = (body: string): Map<string, string> =>
  new Map(declarations(body).map((d) => [d.name, d.value]))

export const rulesWithPrelude = (css: string, prelude: string): Rule[] =>
  topLevelRules(css).filter((r) => r.prelude === prelude)

// ---------------------------------------------------------------------------
// Couleurs / contraste WCAG 2.x
// ---------------------------------------------------------------------------
export const isHex6 = (value: string): boolean => /^#[0-9a-f]{6}$/i.test(value)

const channel = (value: number): number => {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export const luminance = (hex: string): number => {
  if (!isHex6(hex)) throw new Error(`Couleur hexadécimale attendue : ${hex}`)
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export const contrast = (foreground: string, background: string): number => {
  const a = luminance(foreground)
  const b = luminance(background)
  const [hi, lo] = a >= b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}
