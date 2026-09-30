<script setup lang="ts">
// Un chiffre clé : libellé, valeur en kpi (chiffres tabulaires), variation avec flèche ET mot.
import CpSkeleton from './Skeleton.vue'

export type CpTrend = 'up' | 'down' | 'flat'

const props = defineProps<{
  label: string
  value: string | number
  trend?: CpTrend
  trendValue?: string
  /** Une baisse peut être une bonne nouvelle (ex. coûts) : inverse les couleurs. */
  invertTrend?: boolean
  loading?: boolean
}>()

const { t } = useI18n()

const TREND_ICON: Record<CpTrend, string> = {
  up: 'i-lucide-trending-up',
  down: 'i-lucide-trending-down',
  flat: 'i-lucide-minus',
}

const trendClass = computed(() => {
  if (!props.trend || props.trend === 'flat') return 'text-cp-ink-muted'
  const good = props.invertTrend ? props.trend === 'down' : props.trend === 'up'
  return good ? 'text-cp-success' : 'text-cp-danger'
})
</script>

<template>
  <div
    class="flex flex-col gap-1 rounded-lg border border-cp-line bg-cp-surface p-4 shadow-sm md:p-6"
    data-cp-stat-tile
  >
    <CpSkeleton v-if="loading" shape="tile" />
    <template v-else>
      <p class="text-body-sm text-cp-ink-muted">{{ label }}</p>
      <p class="text-kpi tabular-nums text-cp-ink">{{ value }}</p>
      <p v-if="trend" class="flex items-center gap-1 text-body-sm" :class="trendClass" data-cp-trend>
        <UIcon :name="TREND_ICON[trend]" class="size-4" aria-hidden="true" />
        <span>{{ t(`cp.stat.${trend}`) }}</span>
        <span v-if="trendValue" class="tabular-nums">{{ trendValue }}</span>
      </p>
    </template>
  </div>
</template>
