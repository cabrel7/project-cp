<script setup lang="ts">
const currentStep = ref(0)
const name = ref('')
const system = ref<string | undefined>()
const steps = [{ label: 'Nom' }, { label: 'Système' }, { label: 'Règles' }, { label: 'Résumé' }]
const systemOptions = [
  { value: 'erp', label: 'Logiciel de gestion' },
  { value: 'crm', label: 'Fichier clients' },
]
function next(): void {
  currentStep.value = Math.min(currentStep.value + 1, steps.length - 1)
}
function back(): void {
  currentStep.value = Math.max(currentStep.value - 1, 0)
}

const { t } = useI18n()
</script>

<template>
  <div class="flex min-h-screen flex-col bg-cp-canvas text-cp-ink" data-page="gabarit-wizard">
    <header class="sticky top-0 z-sticky flex items-center gap-4 border-b border-cp-line bg-cp-surface px-4 py-2 md:px-6">
      <NuxtLink to="/app" class="flex size-10 items-center justify-center rounded-md text-cp-ink-muted hover:bg-cp-surface-sunken">
        <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" />
        <span class="sr-only">{{ t('cp.layout.back') }}</span>
      </NuxtLink>
      <span class="text-heading-3 text-cp-ink">Nouvel assistant</span>
      <div class="hidden flex-1 justify-center md:flex">
        <CpStepper :steps="steps" :current-step="currentStep" />
      </div>
      <div class="ml-auto flex items-center gap-2">
        <CpModeToggle />
      </div>
    </header>

    <main class="flex flex-1 flex-col items-center px-4 py-8 md:px-8">
      <CpLayoutWizard :steps="steps" :current-step="currentStep" hide-back-on-first @next="next" @back="back">
        <CpTextField v-if="currentStep === 0" v-model="name" label="Nom de l'assistant" help="Visible par votre équipe." />
        <CpSelect
          v-else-if="currentStep === 1"
          v-model="system"
          label="Système à connecter"
          :options="systemOptions"
          placeholder="Choisir un système"
        />
        <CpSwitch v-else-if="currentStep === 2" label="Demander mon accord avant d'envoyer" />
        <template #summary>
          <section class="rounded-lg border border-cp-line bg-cp-surface p-6 text-body text-cp-ink">
            Résumé : {{ name || 'Sans nom' }}, prêt à être créé.
          </section>
        </template>
        <template #advanced>
          <CpTextField label="Identifiant technique" model-value="assistant-facturation" />
        </template>
      </CpLayoutWizard>
    </main>
  </div>
</template>
