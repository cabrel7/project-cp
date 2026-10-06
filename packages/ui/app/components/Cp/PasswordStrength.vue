<script setup lang="ts">
// Jauge de robustesse (indicatif, la règle réelle est côté API) : 4 segments, statut = couleur + icône + mot.
const props = defineProps<{ password: string }>()

const { t } = useI18n()

const score = computed(() => {
  const p = props.password
  if (!p) return 0
  let points = 0
  if (p.length >= 8) points += 1
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) points += 1
  if (/\d/.test(p)) points += 1
  if (p.length >= 12) points += 1
  return points
})

const levels = ['', 'weak', 'medium', 'strong', 'veryStrong'] as const
const level = computed(() => levels[score.value] ?? '')
const label = computed(() => (level.value ? t(`cp.auth.password.${level.value}`) : ''))
const barColor = computed(() =>
  score.value <= 1 ? 'bg-cp-danger' : score.value === 2 ? 'bg-cp-warning' : 'bg-cp-success',
)
const textColor = computed(() =>
  score.value <= 1 ? 'text-cp-danger' : score.value === 2 ? 'text-cp-warning' : 'text-cp-success',
)
const icon = computed(() =>
  score.value <= 1
    ? 'i-lucide-shield-alert'
    : score.value === 2
      ? 'i-lucide-shield'
      : 'i-lucide-shield-check',
)
</script>

<template>
  <div class="flex flex-col gap-2" data-cp-password-strength>
    <div class="flex gap-1" aria-hidden="true">
      <span
        v-for="i in 4"
        :key="i"
        class="h-1.5 flex-1 rounded-pill"
        :class="i <= score ? barColor : 'bg-cp-line'"
      />
    </div>
    <p class="flex min-h-5 items-center gap-1 text-body-sm" aria-live="polite">
      <template v-if="label">
        <UIcon :name="icon" class="size-4" :class="textColor" aria-hidden="true" />
        <span :class="textColor" data-cp-strength-label>{{ label }}</span>
      </template>
      <span v-else class="text-cp-ink-muted">{{ t('cp.auth.password.minChars', { n: 8 }) }}</span>
    </p>
  </div>
</template>
