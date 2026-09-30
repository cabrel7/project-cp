<script setup lang="ts">
// Fonction hors du plan : on montre ce qu'elle apporte et le plan qui l'inclut, jamais une page d'erreur.
// Une fonction pas encore ouverte (feature flag) ne s'affiche pas du tout : c'est à l'appelant de ne pas monter ce composant.
import CpButton from './Button.vue'

defineProps<{
  feature: string
  benefit: string
  planName: string
}>()

defineEmits<{ 'view-plans': [] }>()

const { t } = useI18n()
</script>

<template>
  <section
    class="flex flex-col gap-4 rounded-lg bg-cp-primary-soft p-4 md:flex-row md:items-center md:p-6"
    data-cp-plan-gate
  >
    <span
      class="flex size-12 shrink-0 items-center justify-center rounded-pill bg-cp-surface text-cp-primary"
    >
      <UIcon name="i-lucide-lock" class="size-6" aria-hidden="true" />
    </span>
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <h3 class="text-heading-3 text-cp-ink" data-cp-feature>{{ feature }}</h3>
      <p class="text-body text-cp-ink" data-cp-benefit>{{ benefit }}</p>
      <p class="text-body-sm text-cp-ink-muted" data-cp-locked>
        {{ t('cp.planGate.locked', { plan: planName }) }}
      </p>
    </div>
    <CpButton
      class="shrink-0"
      :label="t('cp.planGate.viewPlans')"
      @click="$emit('view-plans')"
    />
  </section>
</template>
