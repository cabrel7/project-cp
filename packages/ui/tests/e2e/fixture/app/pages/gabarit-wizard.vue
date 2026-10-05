<script setup lang="ts">
const currentStep = ref(0)
const name = ref('')
const system = ref<string | undefined>()
const navItems = [
  { label: 'Accueil', icon: 'i-lucide-house', value: 'home' },
  { label: 'Assistants', icon: 'i-lucide-bot', value: 'agents', group: 'Construire' },
]
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
</script>

<template>
  <CpAppShell :nav-items="navItems" current-nav="agents" user-name="Awa" data-page="gabarit-wizard">
    <CpLayoutWizard :steps="steps" :current-step="currentStep" hide-back-on-first @next="next" @back="back">
      <CpTextField v-if="currentStep === 0" v-model="name" label="Nom de l’assistant" help="Visible par votre équipe." />
      <CpSelect
        v-else-if="currentStep === 1"
        v-model="system"
        label="Système à connecter"
        :options="systemOptions"
        placeholder="Choisir un système"
      />
      <CpSwitch v-else-if="currentStep === 2" label="Demander mon accord avant d’envoyer" />
      <template #summary>
        <section class="rounded-lg border border-cp-line bg-cp-surface p-6 text-body text-cp-ink">
          Résumé : {{ name || 'Sans nom' }}, prêt à être créé.
        </section>
      </template>
      <template #advanced>
        <CpTextField label="Identifiant technique" model-value="assistant-facturation" />
      </template>
    </CpLayoutWizard>
  </CpAppShell>
</template>
