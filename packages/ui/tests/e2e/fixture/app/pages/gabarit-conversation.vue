<script setup lang="ts">
const input = ref('')
const navItems = [
  { label: 'Accueil', icon: 'i-lucide-house', value: 'home' },
  { label: 'Discussion', icon: 'i-lucide-message-circle', value: 'chat' },
]
const suggestions = [
  { label: 'Résumer mes factures du mois', value: 'summary' },
  { label: 'Relancer les impayés', value: 'reminders' },
  { label: 'Voir mon stock', value: 'stock' },
]
</script>

<template>
  <CpAppShell :nav-items="navItems" current-nav="chat" user-name="Awa" data-page="gabarit-conversation">
    <div class="h-[70vh]">
      <CpLayoutConversation v-model:input="input" title="Discussion" :suggestions="suggestions" show-suggestions>
        <CpChatMessage author="user" content="Peux-tu me dire combien de factures sont en retard ?" />
        <CpChatMessage
          author="ai"
          content="Il y a 4 factures en retard, pour un total de 320 000 FCFA."
          :tool-calls="[{ name: 'invoices.list', label: 'Liste des factures' }]"
          show-disclaimer
        />
      </CpLayoutConversation>
    </div>
  </CpAppShell>
</template>
