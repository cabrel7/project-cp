export default defineNuxtConfig({
  extends: ['@cp/ui'],
  compatibilityDate: '2026-09-29',
  devServer: {
    port: 3000,
  },
  // apiBase vide = même origine ; /v1/** est relayé vers l'API (cookie de session HttpOnly sans CORS).
  // Surcharge : NUXT_PUBLIC_API_BASE (URL publique de l'API) en production.
  runtimeConfig: {
    public: { apiBase: '' },
  },
  routeRules: {
    '/v1/**': { proxy: 'http://localhost:4000/v1/**' },
  },
  typescript: {
    strict: true,
    tsConfig: {
      compilerOptions: {
        noUncheckedIndexedAccess: true,
        verbatimModuleSyntax: true,
      },
    },
  },
})
