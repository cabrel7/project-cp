<script setup lang="ts">
// Confirmation proportionnée au risque. Échap / voile = annuler, sauf pendant l'action.
import CpButton from './Button.vue'

export type CpConfirmVariant = 'danger' | 'warning' | 'default'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: CpConfirmVariant
    loading?: boolean
  }>(),
  { variant: 'default' },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const { t } = useI18n()
const confirmText = computed(
  () =>
    props.confirmLabel ??
    (props.variant === 'danger' ? t('cp.dialog.confirmDanger') : t('cp.dialog.confirm')),
)
const cancelText = computed(() => props.cancelLabel ?? t('cp.dialog.cancel'))

function onOpenChange(next: boolean) {
  if (!next && !props.loading) emit('cancel')
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :description="description"
    :dismissible="!loading"
    :data-variant="variant"
    @update:open="onOpenChange"
  >
    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <CpButton
          variant="secondary"
          data-cp-cancel
          :label="cancelText"
          :disabled="loading"
          @click="emit('cancel')"
        />
        <CpButton
          data-cp-confirm
          :variant="variant === 'danger' ? 'danger' : 'primary'"
          :label="confirmText"
          :loading="loading"
          @click="emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
