export default defineNuxtConfig({
  extends: ['@cp/ui'],
  compatibilityDate: '2026-09-29',
  devServer: {
    port: 3001,
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
