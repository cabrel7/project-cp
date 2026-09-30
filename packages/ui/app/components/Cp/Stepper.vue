<script setup lang="ts">
// Étapes d'un assistant (G3). `currentStep` = index 0-based ; avant = terminées, après = à venir.
export interface CpStep {
  label: string
  description?: string
}

type StepState = 'done' | 'current' | 'todo'

const props = withDefaults(
  defineProps<{
    steps: CpStep[]
    currentStep: number
    orientation?: 'horizontal' | 'vertical'
  }>(),
  { orientation: 'horizontal' },
)

const { t } = useI18n()

const items = computed(() =>
  props.steps.map((step, index) => ({
    ...step,
    index,
    state: (index < props.currentStep
      ? 'done'
      : index === props.currentStep
        ? 'current'
        : 'todo') as StepState,
  })),
)

const summary = computed(() => {
  const step = props.steps[props.currentStep]
  if (!step) return ''
  return `${t('cp.stepper.step', { current: props.currentStep + 1, total: props.steps.length })} — ${step.label}`
})

const DOT_CLASS: Record<StepState, string> = {
  done: 'bg-cp-success text-cp-on-primary',
  current: 'bg-cp-primary text-cp-on-primary',
  todo: 'bg-cp-surface-sunken text-cp-ink-muted border border-cp-line',
}
const LABEL_CLASS: Record<StepState, string> = {
  done: 'text-cp-ink',
  current: 'text-cp-primary',
  todo: 'text-cp-ink-muted',
}
</script>

<template>
  <div class="flex flex-col gap-3" data-cp-stepper :data-orientation="orientation">
    <p class="text-body-sm text-cp-ink-muted sm:hidden" data-cp-stepper-summary>{{ summary }}</p>
    <ol
      class="gap-4"
      :class="orientation === 'vertical' ? 'flex flex-col' : 'hidden sm:flex sm:flex-row'"
    >
      <li
        v-for="item in items"
        :key="`${item.index}-${item.label}`"
        class="flex flex-1 items-start gap-3"
        :data-state="item.state"
        :aria-current="item.state === 'current' ? 'step' : undefined"
      >
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-pill text-label tabular-nums"
          :class="DOT_CLASS[item.state]"
        >
          <UIcon v-if="item.state === 'done'" name="i-lucide-check" class="size-4" aria-hidden="true" />
          <span v-else>{{ item.index + 1 }}</span>
        </span>
        <div class="flex min-w-0 flex-col">
          <span class="text-label" :class="LABEL_CLASS[item.state]">{{ item.label }}</span>
          <span v-if="item.state === 'done'" class="text-caption text-cp-success">
            {{ t('cp.stepper.completed') }}
          </span>
          <span v-if="item.description" class="text-body-sm text-cp-ink-muted">
            {{ item.description }}
          </span>
        </div>
      </li>
    </ol>
  </div>
</template>
