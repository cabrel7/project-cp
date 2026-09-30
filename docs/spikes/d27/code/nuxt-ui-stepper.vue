<!-- Nuxt UI — UStepper -->
<template>
  <UStepper v-model="currentStep" :items="steps">
    <template #indicator="{ item, index, status }">
      <span v-if="status === 'complete'" class="text-[var(--on-primary)]">✓</span>
      <span v-else>{{ index + 1 }}</span>
    </template>
  </UStepper>
</template>

<script setup lang="ts">
const currentStep = ref(1)
const steps = [
  { title: 'Connecteur' },
  { title: 'Actions' },
  { title: 'Garde-fous' },
  { title: 'Vérification' },
]
</script>

<!--
  Thème dans app.config.ts :
  ui: {
    stepper: {
      indicator: {
        active: 'bg-[var(--primary)] text-[var(--on-primary)]',
        complete: 'bg-[var(--success)] text-white',
        incomplete: 'bg-[var(--surface-sunken)] text-[var(--ink-muted)] border border-[var(--line)]',
      },
      connector: {
        active: 'bg-[var(--success)]',
        incomplete: 'bg-[var(--line)]',
      },
    },
  }

  + : UStepper intègre navigation, état, a11y
  + : ~15 lignes de template
  + : responsive mobile géré (indicateur numérique « Étape 2 sur 4 »)
  - : pas de « retour en arrière sur étape faite » natif — à câbler via v-model
  - : mobile = rendu linéaire par défaut, pas le format « Étape 2 sur 4 — Nom »
-->
