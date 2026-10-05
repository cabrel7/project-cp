<script setup lang="ts">
// Gabarit G6 — Conversation (chat du workspace, agent conversationnel).
export interface CpSuggestion {
  label: string
  value: string
}

const props = defineProps<{
  title?: string
  inputPlaceholder?: string
  suggestions?: CpSuggestion[]
  inputDisabled?: boolean
  sending?: boolean
  showSuggestions?: boolean
}>()

const inputModel = defineModel<string>('input', { default: '' })

const emit = defineEmits<{
  send: []
  suggest: [value: string]
}>()

const { t } = useI18n()

function submit(): void {
  if (!props.inputDisabled && inputModel.value.trim().length > 0) emit('send')
}
</script>

<template>
  <div class="flex h-full flex-col" data-cp-layout-conversation>
    <header v-if="title || $slots.header" class="border-b border-cp-line p-4">
      <slot name="header">
        <h2 class="text-heading-2 text-cp-ink">{{ title }}</h2>
      </slot>
    </header>
    <div role="log" aria-live="polite" class="flex flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6" data-cp-messages>
      <div v-if="showSuggestions && suggestions?.length" class="flex flex-wrap justify-center gap-2">
        <button
          v-for="s in suggestions"
          :key="s.value"
          type="button"
          class="min-h-11 rounded-lg border border-cp-line bg-cp-surface px-4 py-2 text-body-sm text-cp-ink transition-colors hover:bg-cp-primary-soft hover:text-cp-primary"
          data-cp-suggestion
          @click="emit('suggest', s.value)"
        >
          {{ s.label }}
        </button>
      </div>
      <slot />
    </div>
    <footer class="sticky bottom-0 z-sticky border-t border-cp-line bg-cp-surface p-3 md:p-4" data-cp-chat-input>
      <form class="mx-auto flex max-w-reading-max items-end gap-2" @submit.prevent="submit">
        <slot name="input-actions" />
        <UTextarea
          v-model="inputModel"
          :placeholder="inputPlaceholder ?? t('cp.layout.chatPlaceholder')"
          :aria-label="t('cp.layout.chatPlaceholder')"
          autoresize
          :rows="1"
          :maxrows="6"
          class="flex-1"
          :disabled="inputDisabled"
          @keydown.enter.exact.prevent="submit"
        />
        <UButton
          type="submit"
          icon="i-lucide-send"
          :aria-label="t('cp.layout.send')"
          :disabled="inputDisabled || !inputModel?.trim()"
          :loading="sending"
        />
      </form>
    </footer>
  </div>
</template>
