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
  app: {
    head: {
      // viewport-fit=cover : permet à `env(safe-area-inset-bottom)` d'agir (barre « Vérifier » collante).
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      ],
    },
  },
  // Icônes des écrans d'authentification servies avec le client : sans cela, une icône absente du
  // paquet (ex. hors ligne) ne pourrait pas être récupérée au moment où le réseau manque.
  icon: {
    clientBundle: {
      icons: [
        'lucide:wifi-off',
        'lucide:clock',
        'lucide:circle-alert',
        'lucide:lightbulb',
        'lucide:smartphone',
        'lucide:arrow-left',
        'lucide:key-round',
      ],
      scan: true,
    },
  },
  routeRules: {
    // Écran du code SMS : dépend de la demande mémorisée dans sessionStorage (navigateur seulement).
    '/auth/phone/**': { ssr: false },
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
