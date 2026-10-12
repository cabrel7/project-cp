import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['tests/e2e/**', 'tests/e2e-real/**', 'node_modules/**'],
  },
})
