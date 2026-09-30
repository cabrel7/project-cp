<script setup lang="ts">
// Une ligne : recherche + filtres (slot). Les filtres actifs sont effaçables d'un clic.
const props = defineProps<{
  searchPlaceholder?: string
  /** Nombre de filtres actifs (hors recherche) : affiche « Effacer les filtres » s'il est > 0. */
  activeCount?: number
}>()

const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ clear: [] }>()

const { t } = useI18n()
const canClear = computed(() => (props.activeCount ?? 0) > 0 || model.value !== '')

function clear() {
  model.value = ''
  emit('clear')
}
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-3 rounded-lg border border-cp-line bg-cp-surface p-3"
    role="search"
    data-cp-filter-bar
  >
    <UInput
      v-model="model"
      class="min-w-48 flex-1"
      icon="i-lucide-search"
      type="search"
      :placeholder="searchPlaceholder ?? t('cp.filter.search')"
      :aria-label="searchPlaceholder ?? t('cp.filter.search')"
    />
    <slot />
    <UButton
      v-if="canClear"
      data-cp-clear
      size="md"
      color="neutral"
      variant="ghost"
      icon="i-lucide-x"
      :label="t('cp.filter.clear')"
      @click="clear"
    />
  </div>
</template>
