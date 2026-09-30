<script setup lang="ts">
// Message dans la page : titre court, phrase qui explique, action proposée.
// En mode Technique : code d'erreur + identifiant de requête (code-sm, copiables).
export type CpAlertVariant = 'info' | 'success' | 'warning' | 'danger' | 'tip'

export interface CpAlertAction {
  label: string
  onClick: () => void
}

interface AlertStyle {
  box: string
  text: string
  icon: string
}

// Classes complètes (pas de concaténation) pour que Tailwind les détecte.
const ALERT_STYLE: Record<CpAlertVariant, AlertStyle> = {
  info: {
    box: 'bg-cp-info-soft border-cp-info',
    text: 'text-cp-info',
    icon: 'i-lucide-info',
  },
  success: {
    box: 'bg-cp-success-soft border-cp-success',
    text: 'text-cp-success',
    icon: 'i-lucide-circle-check',
  },
  warning: {
    box: 'bg-cp-warning-soft border-cp-warning',
    text: 'text-cp-warning',
    icon: 'i-lucide-triangle-alert',
  },
  danger: {
    box: 'bg-cp-danger-soft border-cp-danger',
    text: 'text-cp-danger',
    icon: 'i-lucide-circle-alert',
  },
  tip: {
    box: 'bg-cp-accent-soft border-cp-accent',
    text: 'text-cp-accent-text',
    icon: 'i-lucide-lightbulb',
  },
}

const props = defineProps<{
  variant: CpAlertVariant
  title: string
  description?: string
  action?: CpAlertAction
  errorCode?: string
  requestId?: string
  dismissible?: boolean
  /** Mode Technique : ajoute code d'erreur et identifiant de requête (il n'enlève rien au mode Simple). */
  technicalMode?: boolean
}>()

const emit = defineEmits<{ dismiss: [] }>()

const { t } = useI18n()
const style = computed(() => ALERT_STYLE[props.variant])
// Les erreurs et avertissements sont annoncés immédiatement ; le reste poliment.
const role = computed(() =>
  props.variant === 'danger' || props.variant === 'warning' ? 'alert' : 'status',
)

const visible = ref(true)
const copiedKey = ref<string | null>(null)
let resetTimer: ReturnType<typeof setTimeout> | undefined

const technicalLines = computed(() => {
  if (!props.technicalMode) return []
  const lines: { key: string; value: string; text: string }[] = []
  if (props.errorCode) {
    lines.push({
      key: 'code',
      value: props.errorCode,
      text: t('cp.alert.errorCode', { code: props.errorCode }),
    })
  }
  if (props.requestId) {
    lines.push({
      key: 'request',
      value: props.requestId,
      text: t('cp.alert.requestId', { id: props.requestId }),
    })
  }
  return lines
})

async function copy(key: string, value: string) {
  try {
    await navigator.clipboard.writeText(value)
    copiedKey.value = key
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => {
      copiedKey.value = null
    }, 2000)
  } catch {
    // Presse-papiers indisponible (contexte non sécurisé) : la valeur reste sélectionnable à l'écran.
  }
}

function dismiss() {
  visible.value = false
  emit('dismiss')
}

onBeforeUnmount(() => clearTimeout(resetTimer))
</script>

<template>
  <div
    v-if="visible"
    class="flex items-start gap-3 rounded-lg border p-4"
    :class="style.box"
    :role="role"
    :data-variant="variant"
  >
    <UIcon :name="style.icon" class="mt-0.5 size-5 shrink-0" :class="style.text" aria-hidden="true" />
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <p class="text-label font-semibold" :class="style.text">{{ title }}</p>
      <p v-if="description" class="text-body-sm text-cp-ink">{{ description }}</p>
      <ul v-if="technicalLines.length" class="flex flex-col gap-1" data-cp-technical>
        <li v-for="line in technicalLines" :key="line.key" class="flex items-center gap-1">
          <span class="text-code-sm font-mono text-cp-ink-muted">{{ line.text }}</span>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            :icon="copiedKey === line.key ? 'i-lucide-check' : 'i-lucide-copy'"
            :aria-label="copiedKey === line.key ? t('cp.alert.copied') : t('cp.alert.copy')"
            @click="copy(line.key, line.value)"
          />
        </li>
      </ul>
      <div v-if="action" class="mt-2">
        <UButton
          size="sm"
          color="neutral"
          variant="outline"
          :label="action.label"
          @click="action.onClick()"
        />
      </div>
    </div>
    <UButton
      v-if="dismissible"
      size="sm"
      color="neutral"
      variant="ghost"
      icon="i-lucide-x"
      :aria-label="t('cp.alert.close')"
      @click="dismiss"
    />
  </div>
</template>
