import { z } from 'zod'

export const publicIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)

export type PublicId = z.infer<typeof publicIdSchema>

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type PaginationInput = z.infer<typeof paginationSchema>

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    request_id: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    hint: z.string().optional(),
    documentation_url: z.string().url().optional(),
  }),
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>

export function paginatedSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      next_cursor: z.string().nullable(),
      has_more: z.boolean(),
    }),
  })
}

export type Paginated<T> = {
  data: T[]
  pagination: {
    next_cursor: string | null
    has_more: boolean
  }
}
