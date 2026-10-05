<script setup lang="ts">
// Code en texte préformaté (pas de coloration syntaxique pour l'instant) + bouton Copier.
import { useCpCopy } from '../../composables/useCpCopy'

const props = defineProps<{
  code: string
  language?: string
  copyable?: boolean
}>()

const { t } = useI18n()
const { copied, copy } = useCpCopy()
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-cp-line bg-cp-surface-sunken" data-cp-code-block>
    <div
      v-if="language || copyable"
      class="flex items-center justify-between gap-2 border-b border-cp-line px-3 py-1"
    >
      <span class="font-mono text-code-sm text-cp-ink-muted" data-cp-language>{{ language }}</span>
      <UButton
        v-if="copyable"
        size="sm"
        color="neutral"
        variant="ghost"
        data-cp-copy
        :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        :label="copied ? t('cp.code.copied') : t('cp.code.copy')"
        @click="copy(props.code)"
      />
    </div>
    <pre class="overflow-x-auto p-4 font-mono text-code text-cp-ink" tabindex="0"><code>{{ code }}</code></pre>
    <span class="sr-only" aria-live="polite">{{ copied ? t('cp.code.copied') : '' }}</span>
  </div>
</template>
