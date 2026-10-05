import { customType } from 'drizzle-orm/pg-core'

/** `bytea` — no native type in drizzle-orm/pg-core. */
export const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'bytea',
})

/** `citext` — case-insensitive text, handled at the DB layer. */
export const citext = customType<{ data: string; driverData: string }>({
  dataType: () => 'citext',
})

/** `tstzrange` — timestamptz range, returned as a string pair `[start, end]`. */
export const tstzrange = customType<{ data: string; driverData: string }>({
  dataType: () => 'tstzrange',
})
