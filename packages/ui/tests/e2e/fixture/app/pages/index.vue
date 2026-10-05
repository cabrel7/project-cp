<script setup lang="ts">
const pages = [
  { to: '/app', label: 'Shell application' },
  { to: '/admin', label: 'Shell administration' },
  { to: '/gabarit-list', label: 'G1 Liste' },
  { to: '/gabarit-detail', label: 'G2 Détail' },
  { to: '/gabarit-wizard', label: 'G3 Assistant pas à pas' },
  { to: '/gabarit-dashboard', label: 'G4 Tableau de bord' },
  { to: '/gabarit-settings', label: 'G5 Réglages' },
  { to: '/gabarit-conversation', label: 'G6 Conversation' },
  { to: '/gabarit-editor', label: 'G7 Éditeur' },
  { to: '/gabarit-auth', label: 'G8 Autorisation' },
  { to: '/catalog', label: 'Catalogue des composants' },
]
</script>

<template>
  <main class="mx-auto flex max-w-reading-max flex-col gap-4 p-6 text-cp-ink" data-page="index">
    <h1 class="text-heading-1">Pages de démonstration</h1>
    <ul class="flex flex-col gap-2">
      <li v-for="page in pages" :key="page.to">
        <NuxtLink :to="page.to" class="text-body text-cp-primary hover:underline">{{ page.label }}</NuxtLink>
      </li>
    </ul>
  </main>
</template>
