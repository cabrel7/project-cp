import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    // @vue/test-utils (CJS) doit partager l'instance de `vue` des SFC (ESM) : on le passe par le graphe de Vite.
    server: { deps: { inline: ['@vue/test-utils'] } },
    include: ['tests/**/*.test.ts'],
  },
})
