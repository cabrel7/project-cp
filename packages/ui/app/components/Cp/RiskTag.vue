<script setup lang="ts">
// Niveau de risque d'une action : 1 à 4 barres + un mot (jamais la couleur seule).
export type CpRiskLevel = 'low' | 'medium' | 'high' | 'critical'

interface RiskStyle {
  bars: number
  text: string
}

const RISK_STYLE: Record<CpRiskLevel, RiskStyle> = {
  low: { bars: 1, text: 'text-cp-success' },
  medium: { bars: 2, text: 'text-cp-warning' },
  high: { bars: 3, text: 'text-cp-danger' },
  critical: { bars: 4, text: 'text-cp-danger font-bold' },
}

const BAR_HEIGHT = ['h-2', 'h-3', 'h-4', 'h-5'] as const

const props = defineProps<{ level: CpRiskLevel }>()

const { t } = useI18n()
const style = computed(() => RISK_STYLE[props.level])
</script>

<template>
  <span class="inline-flex items-center gap-2" :class="style.text" :data-level="level">
    <span class="flex items-end gap-0.5" aria-hidden="true">
      <span
        v-for="(height, index) in BAR_HEIGHT"
        :key="height"
        data-cp-bar
        class="w-1 rounded-sm"
        :class="[height, index < style.bars ? 'bg-current' : 'bg-cp-line-strong']"
        :data-filled="index < style.bars"
      />
    </span>
    <span class="text-label">{{ t(`cp.risk.${level}`) }}</span>
  </span>
</template>
