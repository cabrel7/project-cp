<script setup lang="ts">
// Zone sans contenu : pastille d'icône, titre qui dit ce qui manque, phrase, UNE action.
// Sans titre ni phrase : textes génériques i18n. Avec un titre seul : pas de phrase par défaut.
import CpButton from './Button.vue'

export interface CpEmptyStateAction {
  label: string
  onClick: () => void
}

const props = defineProps<{
  icon?: string
  title?: string
  description?: string
  action?: CpEmptyStateAction
}>()

const { t } = useI18n()
const heading = computed(() => props.title ?? t('cp.empty.title'))
const text = computed(
  () => props.description ?? (props.title === undefined ? t('cp.empty.description') : undefined),
)
</script>

<template>
  <div class="flex flex-col items-center gap-3 px-6 py-10 text-center" data-cp-empty-state>
    <span
      class="flex size-12 items-center justify-center rounded-pill bg-cp-primary-soft text-cp-primary"
    >
      <UIcon :name="icon ?? 'i-lucide-inbox'" class="size-6" aria-hidden="true" />
    </span>
    <h3 class="text-heading-3 text-cp-ink">{{ heading }}</h3>
    <p v-if="text" class="max-w-md text-body text-cp-ink-muted">{{ text }}</p>
    <CpButton v-if="action" class="mt-2" :label="action.label" @click="action.onClick()" />
  </div>
</template>
