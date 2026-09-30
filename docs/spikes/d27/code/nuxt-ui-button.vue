<!-- Nuxt UI — CpButton serait un simple wrapper de <UButton> thémé via app.config.ts -->
<template>
  <UButton
    :label="label"
    :variant="variant"
    :size="size"
    :loading="loading"
    :disabled="disabled"
    :icon="icon"
  />
</template>

<script setup lang="ts">
defineProps<{
  label: string
  variant?: 'solid' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  icon?: string
}>()
</script>

<!--
  Thème dans app.config.ts :
  export default defineAppConfig({
    ui: {
      button: {
        rounded: 'rounded-[var(--radius-md)]',
        size: {
          sm: 'h-[var(--control-sm)] px-3 text-[13px]',
          md: 'h-[var(--control-md)] px-4 text-sm',
          lg: 'h-[var(--control-lg)] px-5 text-base',
        },
        variant: {
          solid: 'bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-hover)]',
          outline: 'border border-[var(--line-strong)] hover:bg-[var(--primary-soft)]',
          ghost: 'text-[var(--ink-muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--ink)]',
          destructive: 'bg-[var(--danger)] text-[var(--on-danger)] hover:opacity-90',
        },
      },
    },
  })

  + : un seul fichier de thème centralise tout
  + : UButton gère loading, disabled, icon, a11y nativement
  - : syntaxe arbitraire Tailwind pour var(--...) partout
  - : on dépend du système de thème de Nuxt UI (breaking changes entre majeures)
-->
