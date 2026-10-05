<script setup lang="ts">
// G3 — assistant pas à pas : étapes, contenu en largeur de lecture, options avancées, pied collant sur mobile.
import { useCpMode } from '../../composables/useCpMode'
import CpStepper, { type CpStep } from './Stepper.vue'

const props = defineProps<{
  steps: CpStep[]
  currentStep: number
  nextLabel?: string
  backLabel?: string
  nextDisabled?: boolean
  nextLoading?: boolean
  hideBackOnFirst?: boolean
}>()

const emit = defineEmits<{ next: []; back: [] }>()

const { t } = useI18n()
const { technicalMode } = useCpMode()
const showSummary = computed(() => props.currentStep >= props.steps.length - 1)
</script>

<template>
  <div class="mx-auto flex max-w-reading-max flex-col gap-6" data-cp-layout-wizard>
    <CpStepper :steps="steps" :current-step="currentStep" />
    <div class="flex flex-1 flex-col gap-6">
      <slot v-if="!$slots.summary || !showSummary" />
      <slot v-else name="summary" />
      <details v-if="$slots.advanced" :open="technicalMode || undefined">
        <summary class="cursor-pointer text-label text-cp-primary">
          {{ t('cp.layout.advancedOptions') }}
        </summary>
        <div class="mt-4">
          <slot name="advanced" />
        </div>
      </details>
    </div>
    <footer
      class="sticky bottom-0 z-sticky flex justify-between gap-3 border-t border-cp-line bg-cp-canvas p-4 md:static md:justify-end md:border-0 md:p-0"
      data-cp-layout-wizard-footer
    >
      <UButton v-if="!hideBackOnFirst || currentStep > 0" variant="outline" data-cp-back @click="emit('back')">
        {{ backLabel ?? t('cp.layout.back') }}
      </UButton>
      <UButton :disabled="nextDisabled" :loading="nextLoading" data-cp-next @click="emit('next')">
        {{ nextLabel ?? t('cp.layout.next') }}
      </UButton>
    </footer>
  </div>
</template>
