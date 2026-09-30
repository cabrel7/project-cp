import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-29',
  // Polices : @nuxt/fonts télécharge les fichiers à la compilation (échoue hors ligne / derrière un proxy TLS) ;
  // on utilise donc @fontsource (auto-hébergé, importé dans theme.css) — repli prévu par le lot P1.1.
  modules: ['@nuxt/ui', '@nuxtjs/i18n'],
  // Chemin absolu : les entrées css sont résolues comme des ids de module, pas relativement au layer.
  css: [fileURLToPath(new URL('./assets/css/theme.css', import.meta.url))],
  // Nuxt UI embarque @nuxt/fonts par défaut : désactivé, les polices viennent de @fontsource.
  ui: { fonts: false },
  icon: { serverBundle: 'local', collections: ['lucide'] },
  // D53 : i18n dans le layer ; les fichiers de langue de packages/ui (clés `cp.*`) sont fusionnés avec ceux des apps.
  i18n: {
    locales: [
      { code: 'fr', language: 'fr-FR', file: 'fr.json' },
      { code: 'en', language: 'en-US', file: 'en.json' },
    ],
    defaultLocale: 'fr',
    strategy: 'no_prefix',
  },
  colorMode: { classSuffix: '', preference: 'system', fallback: 'light' },
})
