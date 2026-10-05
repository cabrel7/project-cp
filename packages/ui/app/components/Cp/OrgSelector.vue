<script setup lang="ts">
defineProps<{
  /** Nom de l'organisation (tronqué si long). */
  orgName: string
  /** Initiales (1-2 caractères). */
  orgInitials: string
  /** Libellé du plan (ex : « Formule Starter »). */
  planLabel: string
}>()

const emit = defineEmits<{
  switch: []
}>()

const { t } = useI18n()
</script>

<template>
  <button
    type="button"
    class="flex min-h-14 w-full items-center gap-3 border-t border-cp-line px-3 text-left hover:bg-cp-surface md:min-h-12"
    :aria-label="`${t('cp.shell.switchOrg')} : ${orgName}`"
    data-cp-org-selector
    @click="emit('switch')"
  >
    <span
      class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cp-amber-soft text-label font-semibold text-cp-amber-text md:size-8"
      aria-hidden="true"
      data-cp-org-initials
    >
      {{ orgInitials }}
    </span>
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="truncate text-label font-semibold text-cp-ink">{{ orgName }}</span>
      <span class="text-caption text-cp-ink-muted" data-cp-org-plan>{{ planLabel }}</span>
    </span>
    <UIcon name="i-lucide-chevrons-up-down" class="size-4 shrink-0 text-cp-ink-muted" aria-hidden="true" />
  </button>
</template>
