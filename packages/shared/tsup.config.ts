import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/errors.ts', 'src/schemas.ts', 'src/glossary.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
})
