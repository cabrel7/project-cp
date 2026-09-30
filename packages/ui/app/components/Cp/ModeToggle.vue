<script setup lang="ts">
// Contrôle segmenté de 2 à 3 options exclusives.
// Sans `options` : bascule Simple / Technique branchée sur useCpMode (mémorisée par utilisateur par l'app).
// Avec `options` + v-model : choix générique (ex. période 7 j / 30 j / 90 j).
import { useCpMode } from '../../composables/useCpMode'

export interface CpModeOption {
  label: string
  value: string
}

const props = defineProps<{
  options?: CpModeOption[]
  /** Nom accessible du groupe (défaut : « Mode d'affichage »). */
  label?: string
}>()

const model = defineModel<string>()

const { t } = useI18n()
const { technicalMode, toggle } = useCpMode()

const isModeSwitch = computed(() => props.options === undefined)

const items = computed<CpModeOption[]>(
  () =>
    props.options ?? [
      { label: t('cp.mode.simple'), value: 'simple' },
      { label: t('cp.mode.technique'), value: 'technical' },
    ],
)

const current = computed(() =>
  isModeSwitch.value ? (technicalMode.value ? 'technical' : 'simple') : model.value,
)

function select(value: string): void {
  if (value === current.value) return
  if (isModeSwitch.value) toggle()
  else model.value = value
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label ?? t('cp.mode.label')"
    class="inline-flex items-center gap-1 rounded-pill bg-cp-surface-sunken p-1"
    data-cp-mode-toggle
  >
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      role="radio"
      :aria-checked="item.value === current"
      :data-value="item.value"
      class="min-h-11 rounded-pill px-4 text-label motion-safe:transition-colors md:min-h-8"
      :class="
        item.value === current
          ? 'bg-cp-surface text-cp-ink shadow-sm'
          : 'text-cp-ink-muted hover:text-cp-ink'
      "
      @click="select(item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>
