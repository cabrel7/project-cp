import { describe, expect, expectTypeOf, it } from 'vitest'
import { GLOSSARY, type GlossaryMode, type GlossaryTerm, type Locale, t } from '../glossary.js'

const LOCALES: readonly Locale[] = ['fr', 'en']
const MODES: readonly GlossaryMode[] = ['simple', 'technical']
const COMBINATIONS = LOCALES.flatMap((locale) => MODES.map((mode) => [locale, mode] as const))

const EXPECTED_TERMS = [
  'connector',
  'mcp_server',
  'tool',
  'agent',
  'capability',
  'workspace',
  'environment',
  'run',
  'prompt',
  'token',
  'api_key',
  'webhook',
  'guardrail',
  'routing_profile',
  'credit',
  'budget',
  'approval',
  'byok',
] as const satisfies readonly GlossaryTerm[]

const termsOf = (locale: Locale, mode: GlossaryMode) => Object.keys(GLOSSARY[locale][mode]).sort()

describe('GLOSSARY', () => {
  it('doit exposer exactement les langues fr et en', () => {
    expect(Object.keys(GLOSSARY).sort()).toEqual(['en', 'fr'])
  })

  it.each(COMBINATIONS)('doit exposer les deux modes pour %s', (locale) => {
    expect(Object.keys(GLOSSARY[locale]).sort()).toEqual(['simple', 'technical'])
  })

  it.each(COMBINATIONS)('doit définir la combinaison %s × %s', (locale, mode) => {
    expect(GLOSSARY[locale][mode]).toBeDefined()
  })

  it('doit contenir 18 termes', () => {
    expect(EXPECTED_TERMS).toHaveLength(18)
  })

  it.each(COMBINATIONS)('doit contenir tous les termes attendus pour %s × %s', (locale, mode) => {
    expect(termsOf(locale, mode)).toEqual([...EXPECTED_TERMS].sort())
  })

  it.each(COMBINATIONS)(
    'doit avoir une valeur non vide et sans espace parasite pour %s × %s',
    (locale, mode) => {
      for (const term of EXPECTED_TERMS) {
        const value: string = GLOSSARY[locale][mode][term]
        expect(value, `${locale}.${mode}.${term}`).toBeTypeOf('string')
        expect(value.length, `${locale}.${mode}.${term}`).toBeGreaterThan(0)
        expect(value, `${locale}.${mode}.${term}`).toBe(value.trim())
      }
    },
  )

  it('doit avoir le même ensemble de termes en mode simple et technique', () => {
    for (const locale of LOCALES) {
      expect(termsOf(locale, 'simple')).toEqual(termsOf(locale, 'technical'))
    }
  })

  it('doit avoir le même ensemble de termes en français et en anglais', () => {
    for (const mode of MODES) {
      expect(termsOf('fr', mode)).toEqual(termsOf('en', mode))
    }
  })

  it('doit utiliser des clés en snake_case ASCII', () => {
    for (const term of EXPECTED_TERMS) {
      expect(term).toMatch(/^[a-z]+(_[a-z]+)*$/)
    }
  })

  it('doit différencier simple et technique pour les termes vulgarisés (glossaire Simple/Technique)', () => {
    expect(GLOSSARY.fr.simple.connector).not.toBe(GLOSSARY.fr.technical.connector)
    expect(GLOSSARY.fr.simple.mcp_server).not.toBe(GLOSSARY.fr.technical.mcp_server)
    expect(GLOSSARY.en.simple.capability).not.toBe(GLOSSARY.en.technical.capability)
    expect(GLOSSARY.en.simple.approval).not.toBe(GLOSSARY.en.technical.approval)
  })
})

describe('t', () => {
  it.each(COMBINATIONS)(
    'doit retourner la valeur du glossaire pour chaque terme en %s × %s',
    (locale, mode) => {
      for (const term of EXPECTED_TERMS) {
        expect(t(term, locale, mode)).toBe(GLOSSARY[locale][mode][term])
      }
    },
  )

  it.each([
    ['connector', 'fr', 'simple', 'système connecté'],
    ['connector', 'fr', 'technical', 'connecteur'],
    ['connector', 'en', 'simple', 'connected system'],
    ['connector', 'en', 'technical', 'connector'],
    ['mcp_server', 'fr', 'simple', 'accès IA'],
    ['mcp_server', 'fr', 'technical', 'serveur MCP'],
    ['mcp_server', 'en', 'simple', 'AI access point'],
    ['mcp_server', 'en', 'technical', 'MCP server'],
    ['api_key', 'fr', 'simple', "clé d'accès"],
    ['api_key', 'en', 'technical', 'API key'],
    ['approval', 'fr', 'simple', 'à valider'],
    ['approval', 'en', 'technical', 'approval required'],
    ['byok', 'fr', 'simple', 'votre propre clé IA'],
    ['byok', 'en', 'technical', 'BYOK'],
  ] as const)('doit traduire %s en %s/%s par « %s »', (term, locale, mode, expected) => {
    expect(t(term, locale, mode)).toBe(expected)
  })

  it('doit typer GlossaryTerm avec toutes les clés du glossaire', () => {
    expectTypeOf<GlossaryTerm>().toEqualTypeOf<keyof typeof GLOSSARY.en.technical>()
    expectTypeOf<GlossaryTerm>().toEqualTypeOf<keyof typeof GLOSSARY.fr.simple>()
    expectTypeOf<'connector'>().toExtend<GlossaryTerm>()
    expectTypeOf<'inconnu'>().not.toExtend<GlossaryTerm>()
  })

  it('doit typer Locale, GlossaryMode et le retour de t', () => {
    expectTypeOf<Locale>().toEqualTypeOf<'fr' | 'en'>()
    expectTypeOf<GlossaryMode>().toEqualTypeOf<'simple' | 'technical'>()
    expectTypeOf(t).returns.toBeString()
  })
})
