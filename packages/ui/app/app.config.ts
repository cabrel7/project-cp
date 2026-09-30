export default defineAppConfig({
  ui: {
    colors: {
      primary: 'primary',
      secondary: 'secondary',
      neutral: 'warm',
      success: 'success',
      warning: 'warning',
      error: 'error',
      info: 'info',
    },
    // D54 : CpButton = UButton + ces valeurs par défaut (pas de composant métier supplémentaire).
    // primary (défaut) | secondary | ghost | danger (= color="error")
    button: {
      defaultVariants: {
        size: 'md',
      },
    },
  },
})
