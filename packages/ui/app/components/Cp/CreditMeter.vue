<script setup lang="ts">
// Jauge de consommation. Règle du design system : primary jusqu'à 70 %, warning au-delà, danger à 100 %.
// Toujours le pourcentage et les montants écrits ; épuisé = icône + mot.
const props = defineProps<{
  used: number
  total: number
  label?: string
}>()

const { t, locale } = useI18n()

// Arrondi vers le bas : 99,6 % ne doit jamais s'afficher « 100 % / épuisé » tant qu'il reste des crédits.
const isFull = computed(() => props.total <= 0 || props.used >= props.total)
const percent = computed(() => {
  if (props.total <= 0) return props.used > 0 ? 100 : 0
  if (isFull.value) return 100
  return Math.min(99, Math.max(0, Math.floor((props.used / props.total) * 100)))
})
const exhausted = computed(() => isFull.value)

const level = computed<'ok' | 'warning' | 'danger'>(() => {
  if (exhausted.value) return 'danger'
  return percent.value > 70 ? 'warning' : 'ok'
})

const BAR_CLASS = {
  ok: 'bg-cp-primary',
  warning: 'bg-cp-warning',
  danger: 'bg-cp-danger',
} as const

const TEXT_CLASS = {
  ok: 'text-cp-ink-muted',
  warning: 'text-cp-warning',
  danger: 'text-cp-danger',
} as const

const format = (n: number) => new Intl.NumberFormat(locale.value).format(n)
const amounts = computed(() =>
  t('cp.credits.used', { used: format(props.used), total: format(props.total) }),
)
</script>

<template>
  <div class="flex flex-col gap-2" data-cp-credit-meter :data-level="level">
    <p v-if="label" class="text-label text-cp-ink">{{ label }}</p>
    <div
      class="h-2 w-full overflow-hidden rounded-pill bg-cp-surface-sunken"
      role="progressbar"
      :aria-label="label ?? amounts"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="percent"
      :aria-valuetext="`${t('cp.credits.percent', { percent })} — ${amounts}`"
    >
      <div
        class="h-full rounded-pill motion-safe:transition-[width]"
        :class="BAR_CLASS[level]"
        :style="{ width: `${percent}%` }"
        data-cp-bar
      />
    </div>
    <div class="flex flex-wrap items-center justify-between gap-2 text-body-sm">
      <span class="tabular-nums" :class="TEXT_CLASS[level]">{{ amounts }}</span>
      <span class="flex items-center gap-1 tabular-nums" :class="TEXT_CLASS[level]">
        <UIcon v-if="exhausted" name="i-lucide-circle-alert" class="size-4" aria-hidden="true" />
        <span v-if="exhausted" data-cp-exhausted>{{ t('cp.credits.exhausted') }}</span>
        <span>{{ t('cp.credits.percent', { percent }) }}</span>
      </span>
    </div>
  </div>
</template>
