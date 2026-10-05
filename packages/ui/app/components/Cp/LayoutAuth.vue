<script setup lang="ts">
// Gabarit G8 — Autorisation (consentement OAuth, CGU, approbation depuis un lien).
defineProps<{
  title: string
  description?: string
  icon?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmLoading?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-cp-canvas p-4" data-cp-layout-auth>
    <article
      class="flex w-full max-w-reading-max flex-col gap-6 rounded-lg border border-cp-line bg-cp-surface p-6 shadow-sm md:p-8"
    >
      <header class="flex flex-col items-center gap-3 text-center">
        <slot name="header">
          <span class="flex size-16 items-center justify-center rounded-xl bg-cp-primary-soft text-cp-primary">
            <UIcon :name="icon ?? 'i-lucide-shield-check'" class="size-8" aria-hidden="true" />
          </span>
        </slot>
        <h1 class="text-heading-2 text-cp-ink">{{ title }}</h1>
        <p v-if="description" class="text-body text-cp-ink-muted">{{ description }}</p>
      </header>
      <div class="flex flex-col gap-4">
        <slot />
      </div>
      <footer class="flex flex-col gap-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <UButton variant="outline" data-cp-cancel @click="emit('cancel')">
            {{ cancelLabel ?? t('cp.layout.deny') }}
          </UButton>
          <UButton :loading="confirmLoading" data-cp-confirm @click="emit('confirm')">
            {{ confirmLabel ?? t('cp.layout.allow') }}
          </UButton>
        </div>
        <slot name="footer" />
      </footer>
    </article>
  </div>
</template>
