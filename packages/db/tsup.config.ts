import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/client.ts',
    'src/context.ts',
    'src/public-id.ts',
    'src/schema/index.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['postgres'],
})
