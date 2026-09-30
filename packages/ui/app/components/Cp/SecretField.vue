<script setup lang="ts">
// Secret masqué par défaut (longueur fixe : ne révèle pas la taille), révélable, copiable.
import { useCpCopy } from '../../composables/useCpCopy'

const MASK = '••••••••••••'

const props = defineProps<{
  value: string
  label?: string
  copyable?: boolean
  /** Affiche l'avertissement « affiché une seule fois » (création de clé). */
  warning?: boolean
}>()

const { t } = useI18n()
const { copied, copy } = useCpCopy()
const revealed = ref(false)
const shown = computed(() => (revealed.value ? props.value : MASK))
</script>

<template>
  <div class="flex flex-col gap-1" data-cp-secret-field>
    <span v-if="label" class="text-label text-cp-ink" data-label>{{ label }}</span>
    <div
      class="flex items-center gap-2 rounded-md border border-cp-line bg-cp-surface-sunken px-3 py-2"
    >
      <code
        class="min-w-0 flex-1 break-all text-code text-cp-ink"
        :class="revealed ? 'font-mono' : 'font-mono tracking-widest'"
        data-cp-secret-value
      >{{ shown }}</code>
      <UButton
        color="neutral"
        variant="ghost"
        data-cp-toggle
        :icon="revealed ? 'i-lucide-eye-off' : 'i-lucide-eye'"
        :aria-label="revealed ? t('cp.secret.hide') : t('cp.secret.show')"
        :aria-pressed="revealed"
        @click="revealed = !revealed"
      />
      <UButton
        v-if="copyable"
        color="neutral"
        variant="ghost"
        data-cp-copy
        :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        :aria-label="copied ? t('cp.secret.copied') : t('cp.secret.copy')"
        @click="copy(value)"
      />
    </div>
    <p v-if="warning" class="flex items-center gap-1 text-body-sm text-cp-warning" data-cp-warning>
      <UIcon name="i-lucide-triangle-alert" class="size-4" aria-hidden="true" />
      {{ t('cp.secret.warning') }}
    </p>
    <span class="sr-only" aria-live="polite">{{ copied ? t('cp.secret.copied') : '' }}</span>
  </div>
</template>
