<script setup lang="ts">
const blockName = ref('Envoyer un e-mail')
const blockDelay = ref('5')
const navItems = [
  { label: 'Accueil', icon: 'i-lucide-house', value: 'home' },
  { label: 'Assistants', icon: 'i-lucide-bot', value: 'agents', group: 'Construire' },
]
const palette = ['Lire une facture', 'Envoyer un e-mail', 'Demander un accord']
</script>

<template>
  <CpAppShell :nav-items="navItems" current-nav="agents" user-name="Awa" data-page="gabarit-editor">
    <div class="h-[70vh] overflow-hidden rounded-lg border border-cp-line">
      <CpLayoutEditor title="Enchaînement de relance">
        <template #toolbar>
          <CpButton variant="secondary" label="Tester" icon="i-lucide-play" />
          <CpButton label="Enregistrer" />
        </template>
        <template #palette>
          <ul class="flex flex-col gap-2">
            <li
              v-for="item in palette"
              :key="item"
              class="rounded-md border border-cp-line bg-cp-surface p-3 text-body-sm text-cp-ink"
            >
              {{ item }}
            </li>
          </ul>
        </template>
        <template #canvas>
          <div class="flex h-full items-center justify-center text-body text-cp-ink-muted">
            Glissez des blocs ici pour construire l’enchaînement.
          </div>
        </template>
        <template #properties>
          <div class="flex flex-col gap-4">
            <CpTextField v-model="blockName" label="Nom du bloc" />
            <CpTextField v-model="blockDelay" label="Délai (minutes)" type="number" />
          </div>
        </template>
      </CpLayoutEditor>
    </div>
  </CpAppShell>
</template>
