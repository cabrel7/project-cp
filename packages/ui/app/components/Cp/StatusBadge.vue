<script setup lang="ts">
// État d'un objet : un point + un mot + une couleur de statut (jamais la couleur seule).
// Correspondance fixe avec les cycles de vie (docs/design-system/components/StatusBadge).
export type CpStatus =
  | 'active'
  | 'online'
  | 'success'
  | 'paused'
  | 'warning'
  | 'pending'
  | 'error'
  | 'failed'
  | 'revoked'
  | 'draft'
  | 'archived'
  | 'running'
  | 'validating'

type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const VARIANT_BY_STATUS: Record<CpStatus, StatusVariant> = {
  active: 'success',
  online: 'success',
  success: 'success',
  paused: 'warning',
  warning: 'warning',
  pending: 'warning',
  error: 'danger',
  failed: 'danger',
  revoked: 'danger',
  draft: 'neutral',
  archived: 'neutral',
  running: 'info',
  validating: 'info',
}

// Classes complètes (pas de concaténation) pour que Tailwind les détecte.
const DOT_CLASS: Record<StatusVariant, string> = {
  success: 'bg-cp-success',
  warning: 'bg-cp-warning',
  danger: 'bg-cp-danger',
  info: 'bg-cp-info',
  neutral: 'bg-cp-ink-muted',
}

const props = defineProps<{ status: CpStatus }>()

const { t } = useI18n()
const variant = computed(() => VARIANT_BY_STATUS[props.status])
</script>

<template>
  <span class="inline-flex items-center gap-2" :data-variant="variant">
    <span class="size-2 shrink-0 rounded-full" :class="DOT_CLASS[variant]" aria-hidden="true" />
    <span class="text-label text-cp-ink">{{ t(`cp.status.${status}`) }}</span>
  </span>
</template>
