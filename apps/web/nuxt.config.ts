export default defineNuxtConfig({
  compatibilityDate: '2026-09-29',
  devServer: {
    port: 3000,
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
