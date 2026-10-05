<script setup lang="ts">
// CpButton = UButton + valeurs par défaut de project-cp (app.config.ts, D54).
// Variantes : primary (défaut, UNE par vue) | secondary | ghost | danger (= color "error").
// Tailles : sm (control-sm, Technique seulement) | md (control-md, défaut) | lg (control-lg, mobile).
// Toutes les autres props de UButton (label, icon, loading, disabled, to…) passent par $attrs.
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const props = withDefaults(defineProps<{ variant?: ButtonVariant }>(), { variant: 'primary' })

defineOptions({ inheritAttrs: false })

const appearance = computed(() => {
  switch (props.variant) {
    case 'secondary':
      return { color: 'neutral', variant: 'outline' } as const
    case 'ghost':
      return { color: 'neutral', variant: 'ghost' } as const
    case 'danger':
      return { color: 'error', variant: 'solid' } as const
    default:
      return { color: 'primary', variant: 'solid' } as const
  }
})
</script>

<template>
  <UButton v-bind="{ ...$attrs, ...appearance }">
    <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </UButton>
</template>
