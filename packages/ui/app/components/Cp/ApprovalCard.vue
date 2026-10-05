<script setup lang="ts">
// Ce que l'IA veut faire, en clair, avant de le faire : résumé, éléments touchés, risque, délai, 3 actions.
// Mode Technique : paramètres exacts de l'outil (additif). Délai dépassé : actions désactivées, mot + icône.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useCpMode } from '../../composables/useCpMode'
import CpButton from './Button.vue'
import CpCodeBlock from './CodeBlock.vue'
import CpRiskTag, { type CpRiskLevel } from './RiskTag.vue'

export interface CpApprovalItem {
  label: string
  value: string
}

const props = defineProps<{
  summary: string
  items: CpApprovalItem[]
  /** 1 faible · 2 moyen · 3 élevé · 4 critique. */
  risk: 1 | 2 | 3 | 4
  /** Échéance, date ISO 8601. */
  deadline?: string
  /** Paramètres exacts de l'outil, affichés en mode Technique seulement. */
  parameters?: Record<string, unknown>
  loading?: boolean
}>()

defineEmits<{ approve: []; modify: []; reject: [] }>()

const RISK_LEVEL: Record<1 | 2 | 3 | 4, CpRiskLevel> = {
  1: 'low',
  2: 'medium',
  3: 'high',
  4: 'critical',
}

const { t } = useI18n()
const { technicalMode } = useCpMode()

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 30_000)
})
onBeforeUnmount(() => clearInterval(timer))

const remainingMs = computed(() =>
  props.deadline ? new Date(props.deadline).getTime() - now.value : undefined,
)
// Échéance illisible (NaN) : on échoue fermé, l'action n'est pas proposée.
const expired = computed(() => remainingMs.value !== undefined && !(remainingMs.value > 0))

const remainingLabel = computed(() => {
  const ms = remainingMs.value
  if (ms === undefined || !(ms > 0)) return undefined
  const minutes = Math.max(1, Math.ceil(ms / 60_000))
  if (minutes < 60) return t('cp.approval.minutes', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return t('cp.approval.hours', { n: hours })
  return t('cp.approval.days', { n: Math.floor(hours / 24) })
})

const parametersJson = computed(() => JSON.stringify(props.parameters ?? {}, null, 2))
const showParameters = computed(() => technicalMode.value && props.parameters !== undefined)
</script>

<template>
  <article
    class="flex flex-col gap-4 rounded-lg border border-cp-line bg-cp-surface p-4 shadow-sm md:p-6"
    :aria-busy="loading ? 'true' : undefined"
    data-cp-approval-card
  >
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="flex items-center gap-2 text-heading-3 text-cp-ink">
        <UIcon name="i-lucide-shield-check" class="size-5 text-cp-primary" aria-hidden="true" />
        {{ t('cp.approval.title') }}
      </h3>
      <CpRiskTag :level="RISK_LEVEL[risk]" />
    </header>

    <p class="text-body-lg text-cp-ink" data-cp-summary>{{ summary }}</p>

    <dl
      v-if="items.length"
      class="flex flex-col divide-y divide-cp-line rounded-md bg-cp-surface-sunken px-4"
      :aria-label="t('cp.approval.items')"
      data-cp-items
    >
      <div
        v-for="(item, index) in items"
        :key="`${index}-${item.label}`"
        class="flex items-baseline justify-between gap-4 py-2"
        data-cp-item
      >
        <dt class="text-body-sm text-cp-ink-muted">{{ item.label }}</dt>
        <dd class="text-label tabular-nums text-cp-ink">{{ item.value }}</dd>
      </div>
    </dl>

    <div v-if="showParameters" class="flex flex-col gap-2" data-cp-parameters>
      <p class="text-label text-cp-ink-muted">{{ t('cp.approval.parameters') }}</p>
      <CpCodeBlock :code="parametersJson" language="json" copyable />
    </div>

    <p
      v-if="deadline"
      class="flex items-center gap-2 text-body-sm"
      :class="expired ? 'text-cp-danger' : 'text-cp-ink-muted'"
      data-cp-deadline
    >
      <UIcon
        :name="expired ? 'i-lucide-circle-alert' : 'i-lucide-clock'"
        class="size-4"
        aria-hidden="true"
      />
      <span v-if="expired">{{ t('cp.approval.expired') }}</span>
      <span v-else class="tabular-nums">{{ t('cp.approval.deadline', { time: remainingLabel }) }}</span>
    </p>

    <footer class="flex flex-col gap-2 md:flex-row md:justify-end">
      <CpButton
        variant="secondary"
        icon="i-lucide-x"
        :label="t('cp.approval.reject')"
        :disabled="loading || expired"
        data-cp-action="reject"
        @click="$emit('reject')"
      />
      <CpButton
        variant="secondary"
        icon="i-lucide-pencil"
        :label="t('cp.approval.modify')"
        :disabled="loading || expired"
        data-cp-action="modify"
        @click="$emit('modify')"
      />
      <CpButton
        icon="i-lucide-check"
        :label="t('cp.approval.approve')"
        :loading="loading"
        :disabled="expired"
        data-cp-action="approve"
        @click="$emit('approve')"
      />
    </footer>
  </article>
</template>
