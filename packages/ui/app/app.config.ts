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
          md: 'h-10 px-4 text-sm',
          lg: 'h-12 px-5 text-base',
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
          md: 'h-10 px-3 text-sm',
          lg: 'h-12 px-4 text-base',
        },
      },
    },
    select: {
      variants: {
        size: {
          md: 'h-10 px-3 text-sm',
          lg: 'h-12 px-4 text-base',
        },
      },
    },
  },
})
