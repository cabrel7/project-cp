import { describe, expect, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import {
  type ErrorResponse,
  errorResponseSchema,
  type Paginated,
  type PaginationInput,
  type PublicId,
  paginatedSchema,
  paginationSchema,
  publicIdSchema,
} from '../schemas.js'

const UUID_V7_LOWER = '018f3e5a-7b2c-7d4e-8a1f-3c5d7e9f1a2b'
const UUID_V7_UPPER = '018F3E5A-7B2C-7D4E-8A1F-3C5D7E9F1A2B'
const UUID_V7_MIXED = '018f3E5a-7B2c-7d4E-8A1f-3c5D7e9F1a2B'

describe('publicIdSchema', () => {
  it.each([
    ['minuscules', UUID_V7_LOWER],
    ['majuscules', UUID_V7_UPPER],
    ['casse mixte', UUID_V7_MIXED],
  ])('doit accepter un UUIDv7 en %s', (_label, value) => {
    expect(publicIdSchema.safeParse(value).success).toBe(true)
  })

  it('doit retourner la valeur inchangée (pas de normalisation de casse)', () => {
    expect(publicIdSchema.parse(UUID_V7_UPPER)).toBe(UUID_V7_UPPER)
  })

  it.each([
    ['chaîne vide', ''],
    ['trop court', '018f3e5a-7b2c'],
    ['sans tirets', '018f3e5a7b2c7d4e8a1f3c5d7e9f1a2b'],
    ['un caractère de trop', `${UUID_V7_LOWER}0`],
    ['un caractère de moins', UUID_V7_LOWER.slice(0, -1)],
    ['caractère non hexadécimal', '018f3e5a-7b2c-7d4e-8a1f-3c5d7e9f1a2g'],
    ['espace en début', ` ${UUID_V7_LOWER}`],
    ['espace en fin', `${UUID_V7_LOWER} `],
    ['retour à la ligne final', `${UUID_V7_LOWER}\n`],
    ['identifiant interne bigint', '12345'],
    ['accolades', `{${UUID_V7_LOWER}}`],
  ])('doit rejeter %s', (_label, value) => {
    expect(publicIdSchema.safeParse(value).success).toBe(false)
  })

  it.each([
    ['nombre', 12345],
    ['bigint', 12345n],
    ['null', null],
    ['undefined', undefined],
    ['objet', {}],
  ])('doit rejeter une valeur non textuelle (%s)', (_label, value) => {
    expect(publicIdSchema.safeParse(value).success).toBe(false)
  })

  // Invariant 1 : le public_id exposé est un UUIDv7. Le schéma actuel accepte n'importe
  // quel UUID (v1, v4, nil). it.fails passe tant que la lacune existe et casse dès qu'elle
  // est corrigée : il faudra alors le convertir en `it`.
  it('devrait rejeter un UUIDv4 (version 4)', () => {
    expect(publicIdSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(false)
  })

  it('doit typer PublicId comme string', () => {
    expectTypeOf<PublicId>().toEqualTypeOf<string>()
  })
})

describe('paginationSchema', () => {
  it("doit appliquer limit=20 et laisser cursor absent quand l'entrée est vide", () => {
    const result = paginationSchema.parse({})
    expect(result).toEqual({ limit: 20 })
    expect(result.cursor).toBeUndefined()
    expect('cursor' in result).toBe(false)
  })

  it('doit convertir une limite textuelle en nombre (query string)', () => {
    const result = paginationSchema.parse({ limit: '50' })
    expect(result.limit).toBe(50)
    expect(typeof result.limit).toBe('number')
  })

  it('doit accepter une limite numérique', () => {
    expect(paginationSchema.parse({ limit: 35 }).limit).toBe(35)
  })

  it.each([1, 100])('doit accepter la borne limit=%i', (limit) => {
    expect(paginationSchema.parse({ limit }).limit).toBe(limit)
    expect(paginationSchema.parse({ limit: String(limit) }).limit).toBe(limit)
  })

  it.each([0, -1, 101, 1000, '0', '101', '-5'])('doit rejeter limit=%s (hors 1..100)', (limit) => {
    expect(paginationSchema.safeParse({ limit }).success).toBe(false)
  })

  it.each([1.5, '2.5', 'abc', Number.NaN, Number.POSITIVE_INFINITY])(
    'doit rejeter la limite non entière ou non numérique %s',
    (limit) => {
      expect(paginationSchema.safeParse({ limit }).success).toBe(false)
    },
  )

  it('doit rejeter une limite vide (coercition en 0)', () => {
    expect(paginationSchema.safeParse({ limit: '' }).success).toBe(false)
  })

  it('doit accepter un curseur textuel et le conserver tel quel', () => {
    const cursor = 'eyJpZCI6MTIzfQ'
    expect(paginationSchema.parse({ cursor })).toEqual({ cursor, limit: 20 })
  })

  it('doit accepter curseur et limite ensemble', () => {
    expect(paginationSchema.parse({ cursor: 'abc', limit: '10' })).toEqual({
      cursor: 'abc',
      limit: 10,
    })
  })

  it.each([
    ['null', null],
    ['nombre', 42],
    ['objet', {}],
  ])('doit rejeter un curseur non textuel (%s)', (_label, cursor) => {
    expect(paginationSchema.safeParse({ cursor }).success).toBe(false)
  })

  it('doit typer PaginationInput avec limit numérique et cursor optionnel', () => {
    expectTypeOf<PaginationInput['limit']>().toEqualTypeOf<number>()
    expectTypeOf<PaginationInput['cursor']>().toEqualTypeOf<string | undefined>()
  })
})

describe('errorResponseSchema', () => {
  const minimal = {
    error: { code: 'PLATFORM_VALIDATION_ERROR', message: 'Données invalides', request_id: 'req_1' },
  }

  it("doit valider une réponse d'erreur complète", () => {
    const full = {
      error: {
        code: 'MCP_TOOL_INPUT_INVALID',
        message: 'Paramètres non conformes au schéma',
        request_id: 'req_01HZX',
        details: { field: 'amount', nested: { a: 1 } },
        documentation_url: 'https://docs.example.com/errors/mcp_tool_input_invalid',
      },
    }
    expect(errorResponseSchema.parse(full)).toEqual(full)
  })

  it('doit valider une réponse minimale (code, message, request_id)', () => {
    expect(errorResponseSchema.safeParse(minimal).success).toBe(true)
  })

  it('doit accepter details vide', () => {
    expect(
      errorResponseSchema.safeParse({ error: { ...minimal.error, details: {} } }).success,
    ).toBe(true)
  })

  it.each(['code', 'message', 'request_id'] as const)(
    'doit rejeter une réponse sans le champ obligatoire %s',
    (field) => {
      const { [field]: _omitted, ...rest } = minimal.error
      expect(errorResponseSchema.safeParse({ error: rest }).success).toBe(false)
    },
  )

  it('doit rejeter une réponse sans enveloppe error', () => {
    expect(errorResponseSchema.safeParse(minimal.error).success).toBe(false)
    expect(errorResponseSchema.safeParse({}).success).toBe(false)
    expect(errorResponseSchema.safeParse(null).success).toBe(false)
  })

  it.each([
    ['code numérique', { code: 500 }],
    ['message null', { message: null }],
    ['request_id numérique', { request_id: 42 }],
    ['details textuel', { details: 'x' }],
    ['details tableau', { details: [1, 2] }],
    ['documentation_url invalide', { documentation_url: 'pas-une-url' }],
  ])('doit rejeter un type invalide (%s)', (_label, override) => {
    expect(
      errorResponseSchema.safeParse({ error: { ...minimal.error, ...override } }).success,
    ).toBe(false)
  })

  it('doit conserver documentation_url (règle 02 §8)', () => {
    const body = {
      error: { ...minimal.error, documentation_url: 'https://docs.example.com/errors/x' },
    }
    expect(errorResponseSchema.parse(body).error).toHaveProperty('documentation_url')
  })

  it('doit typer ErrorResponse avec une enveloppe error', () => {
    expectTypeOf<ErrorResponse['error']['code']>().toEqualTypeOf<string>()
    expectTypeOf<ErrorResponse['error']['request_id']>().toEqualTypeOf<string>()
  })
})

describe('paginatedSchema', () => {
  const schema = paginatedSchema(z.string())

  it("doit valider une page d'éléments simples avec curseur suivant", () => {
    const page = { data: ['a', 'b'], next_cursor: 'c2' }
    expect(schema.parse(page)).toEqual(page)
  })

  it('doit accepter next_cursor null (dernière page)', () => {
    const page = { data: ['a'], next_cursor: null }
    expect(schema.parse(page).next_cursor).toBeNull()
  })

  it('doit accepter une page vide', () => {
    expect(schema.safeParse({ data: [], next_cursor: null }).success).toBe(true)
  })

  it('doit rejeter next_cursor absent (nullable mais pas optionnel)', () => {
    expect(schema.safeParse({ data: [] }).success).toBe(false)
  })

  it('doit rejeter next_cursor non textuel et non null', () => {
    expect(schema.safeParse({ data: [], next_cursor: 5 }).success).toBe(false)
  })

  it("doit rejeter un élément qui ne respecte pas le schéma d'item", () => {
    expect(schema.safeParse({ data: ['a', 2], next_cursor: null }).success).toBe(false)
  })

  it('doit rejeter data absent ou non tableau', () => {
    expect(schema.safeParse({ next_cursor: null }).success).toBe(false)
    expect(schema.safeParse({ data: 'a', next_cursor: null }).success).toBe(false)
  })

  it("doit fonctionner avec un schéma d'objet (items publicId)", () => {
    const itemSchema = z.object({ id: publicIdSchema, name: z.string() })
    const page = {
      data: [{ id: UUID_V7_LOWER, name: 'x' }],
      next_cursor: null,
    }
    expect(paginatedSchema(itemSchema).parse(page)).toEqual(page)
    expect(
      paginatedSchema(itemSchema).safeParse({
        data: [{ id: 'bad', name: 'x' }],
        next_cursor: null,
      }).success,
    ).toBe(false)
  })

  it('doit produire un type compatible avec Paginated<T>', () => {
    type Inferred = z.infer<typeof schema>
    expectTypeOf<Inferred>().toEqualTypeOf<Paginated<string>>()
  })
})
