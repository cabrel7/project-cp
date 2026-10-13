import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// Tests unitaires purs (node) dans tests/unit ; tests de composants et de pages (happy-dom + @vue/test-utils,
// auto-imports Nuxt fournis comme globales, D55) dans tests/component.
export default defineConfig({
  plugins: [vue({ template: { transformAssetUrls: false } })],
  test: {
    exclude: ['tests/e2e/**', 'tests/e2e-real/**', 'node_modules/**'],
    // @vue/test-utils (CJS) doit partager l'instance de `vue` des SFC (ESM) : on le passe par le graphe de Vite.
    server: { deps: { inline: ['@vue/test-utils'] } },
    setupFiles: ['./tests/component/setup.ts'],
  },
})
