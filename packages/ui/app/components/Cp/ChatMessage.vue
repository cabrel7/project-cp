<script setup lang="ts">
// Message du gabarit Conversation (G6). Utilisateur : bulle primary à droite. IA : bulle surface à gauche,
// pastille IA, outils consultés en puces repliables, mention « Généré par l'IA ».
// Les actions à valider s'insèrent dans le slot par défaut (CpApprovalCard). body-lg en mode Simple.
import { ref } from 'vue'
import { useCpMode } from '../../composables/useCpMode'

export interface CpToolCall {
  name: string
  label: string
}

const props = defineProps<{
  author: 'user' | 'ai'
  content?: string
  toolCalls?: CpToolCall[]
  showDisclaimer?: boolean
  /** Indicateur « l'assistant écrit… ». */
  loading?: boolean
  error?: string
}>()

const { t } = useI18n()
const { technicalMode } = useCpMode()

const isAi = computed(() => props.author === 'ai')
const toolsOpen = ref(false)
const hasTools = computed(() => isAi.value && (props.toolCalls?.length ?? 0) > 0)
const showDisclaimer = computed(
  () => isAi.value && props.showDisclaimer === true && !props.loading && !props.error,
)
const textSize = computed(() => (technicalMode.value ? 'text-body' : 'text-body-lg'))
</script>

<template>
  <div
    class="flex w-full gap-3"
    :class="isAi ? 'justify-start' : 'justify-end'"
    :data-author="author"
    data-cp-chat-message
  >
    <span
      v-if="isAi"
      class="flex size-8 shrink-0 items-center justify-center rounded-pill bg-cp-primary-soft text-cp-primary"
      role="img"
      :aria-label="t('cp.chat.aiLabel')"
      data-cp-ai-badge
    >
      <UIcon name="i-lucide-sparkles" class="size-4" aria-hidden="true" />
    </span>

    <div class="flex min-w-0 max-w-[85%] flex-col gap-2 md:max-w-[70%]" :class="isAi ? 'items-start' : 'items-end'">
      <div v-if="hasTools" class="flex flex-col items-start gap-2" data-cp-tool-calls>
        <button
          type="button"
          class="flex min-h-11 items-center gap-1 rounded-pill bg-cp-surface-sunken px-3 text-body-sm text-cp-ink-muted md:min-h-8"
          :aria-expanded="toolsOpen"
          data-cp-tool-toggle
          @click="toolsOpen = !toolsOpen"
        >
          <UIcon name="i-lucide-wrench" class="size-4" aria-hidden="true" />
          {{ t('cp.chat.toolCalls', { count: toolCalls?.length ?? 0 }) }}
          <UIcon
            :name="toolsOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            class="size-4"
            aria-hidden="true"
          />
        </button>
        <ul v-if="toolsOpen" class="flex flex-wrap gap-2" data-cp-tool-list>
          <li
            v-for="(call, index) in toolCalls"
            :key="`${index}-${call.name}`"
            class="flex items-center gap-2 rounded-pill border border-cp-line bg-cp-surface px-3 py-1 text-body-sm text-cp-ink"
            data-cp-tool-call
          >
            <span>{{ call.label }}</span>
            <span v-if="technicalMode" class="font-mono text-code-sm text-cp-ink-muted">{{ call.name }}</span>
          </li>
        </ul>
      </div>

      <div
        v-if="loading"
        class="flex items-center gap-1 rounded-lg border border-cp-line bg-cp-surface px-4 py-3"
        role="status"
        data-cp-typing
      >
        <span class="sr-only">{{ t('cp.chat.typing') }}</span>
        <span
          v-for="dot in 3"
          :key="dot"
          class="size-2 rounded-pill bg-cp-ink-muted motion-safe:animate-pulse"
          aria-hidden="true"
        />
      </div>

      <div
        v-else-if="error"
        class="flex items-start gap-2 rounded-lg bg-cp-danger-soft px-4 py-3 text-body-sm text-cp-danger"
        role="alert"
        data-cp-error
      >
        <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{{ error }}</span>
      </div>

      <div
        v-else-if="content"
        class="whitespace-pre-wrap break-words rounded-lg px-4 py-3"
        :class="[
          textSize,
          isAi
            ? 'border border-cp-line bg-cp-surface text-cp-ink'
            : 'bg-cp-primary text-cp-on-primary',
        ]"
        data-cp-bubble
      >
        {{ content }}
      </div>

      <div v-if="$slots.default" class="w-full" data-cp-slot>
        <slot />
      </div>

      <p v-if="showDisclaimer" class="text-caption text-cp-ink-muted" data-cp-disclaimer>
        {{ t('cp.chat.disclaimer') }}
      </p>
    </div>
  </div>
</template>
