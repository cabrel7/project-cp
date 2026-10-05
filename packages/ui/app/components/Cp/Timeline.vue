<script setup lang="ts">
// Fil vertical d'une exécution : pastille d'état, phrase claire, heure/durée, ligne de liaison.
export type CpTimelineVariant = 'default' | 'success' | 'warning' | 'danger'

export interface CpTimelineItem {
  title: string
  description?: string
  time: string
  icon?: string
  variant?: CpTimelineVariant
}

defineProps<{ items: CpTimelineItem[] }>()

const DOT_CLASS: Record<CpTimelineVariant, string> = {
  default: 'bg-cp-surface-sunken text-cp-ink-muted border-cp-line',
  success: 'bg-cp-success-soft text-cp-success border-cp-success',
  warning: 'bg-cp-warning-soft text-cp-warning border-cp-warning',
  danger: 'bg-cp-danger-soft text-cp-danger border-cp-danger',
}

const DEFAULT_ICON: Record<CpTimelineVariant, string> = {
  default: 'i-lucide-circle',
  success: 'i-lucide-circle-check',
  warning: 'i-lucide-triangle-alert',
  danger: 'i-lucide-circle-alert',
}
</script>

<template>
  <ol class="flex flex-col" data-cp-timeline>
    <li
      v-for="(item, index) in items"
      :key="`${index}-${item.title}`"
      class="flex gap-3"
      :data-variant="item.variant ?? 'default'"
    >
      <div class="flex flex-col items-center">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-pill border"
          :class="DOT_CLASS[item.variant ?? 'default']"
        >
          <UIcon
            :name="item.icon ?? DEFAULT_ICON[item.variant ?? 'default']"
            class="size-4"
            aria-hidden="true"
          />
        </span>
        <span
          v-if="index < items.length - 1"
          class="w-px flex-1 bg-cp-line"
          data-cp-line
          aria-hidden="true"
        />
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-1 pb-6">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="text-label text-cp-ink">{{ item.title }}</p>
          <span class="text-caption tabular-nums text-cp-ink-muted">{{ item.time }}</span>
        </div>
        <p v-if="item.description" class="text-body-sm text-cp-ink-muted">{{ item.description }}</p>
      </div>
    </li>
  </ol>
</template>
