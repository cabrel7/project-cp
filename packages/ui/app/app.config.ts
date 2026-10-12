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
    button: {
      defaultVariants: {
        size: 'md',
      },
      variants: {
        size: {
          // Objet par slot (et non une chaîne) : une chaîne remplacerait tout le bloc de taille du
          // thème Nuxt UI et ferait disparaître l'espace icône-libellé (gap) et la taille des icônes.
          md: {
            base: 'h-12 px-4 text-sm gap-1.5 md:h-10',
            leadingIcon: 'size-5',
            trailingIcon: 'size-5',
          },
          lg: { base: 'h-12 px-5 text-base gap-2', leadingIcon: 'size-5', trailingIcon: 'size-5' },
        },
      },
      compoundVariants: [
        {
          color: 'primary',
          variant: 'solid',
          class: 'hover:bg-cp-primary-hover active:bg-cp-primary-hover',
        },
        { color: 'error', variant: 'solid', class: 'hover:bg-cp-danger/85 active:bg-cp-danger/85' },
      ],
    },
    input: {
      variants: {
        size: {
          md: 'h-12 px-3 text-sm md:h-10',
          lg: 'h-12 px-4 text-base',
        },
      },
    },
    select: {
      variants: {
        size: {
          md: 'h-12 px-3 text-sm md:h-10',
          lg: 'h-12 px-4 text-base',
        },
      },
    },
  },
})
