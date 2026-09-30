<!-- shadcn-vue — Le composant Button est copié dans le projet et modifié directement -->
<template>
  <button
    :class="cn(buttonVariants({ variant, size }), $attrs.class)"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="spinner" />
    <slot />
  </button>
</template>

<script setup lang="ts">
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

defineProps<{
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
}>()

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium rounded-[--radius-md] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'bg-[--primary] text-[--on-primary] hover:bg-[--primary-hover]',
        outline: 'border border-[--line-strong] text-[--ink] hover:bg-[--primary-soft]',
        ghost: 'text-[--ink-muted] hover:bg-[--primary-soft] hover:text-[--ink]',
        destructive: 'bg-[--danger] text-[--on-danger] hover:opacity-90',
      },
      size: {
        sm: 'h-[--control-sm] px-3 text-[13px]',
        md: 'h-[--control-md] px-4 text-sm',
        lg: 'h-[--control-lg] px-5 text-base',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)
</script>

<!--
  Le composant vit dans components/ui/Button.vue (copié par `npx shadcn-vue@latest add button`).
  On le modifie directement pour mapper nos tokens.

  + : contrôle total sur le markup et le style — pas de couche d'abstraction opaque
  + : cva (class-variance-authority) est simple et stable
  + : Tailwind v4 supporte var(--...) dans les classes arbitraires
  - : plus de code à maintenir (spinner, icon, a11y gérés manuellement)
  - : pas de système de thème centralisé — chaque composant porte ses variants
  - : mise à jour = copier-coller et merger manuellement (pas de npm update)
-->
