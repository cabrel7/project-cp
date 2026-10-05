<script setup lang="ts">
const section = ref('general')
const orgName = ref('Atelier Douala')
const email = ref('awa@exemple.com')
const notifyEmail = ref(true)
const notifyApprovals = ref(false)
const navItems = [{ label: 'Accueil', icon: 'i-lucide-house', value: 'home' }]
const sections = [
  { value: 'general', label: 'Général', icon: 'i-lucide-settings' },
  { value: 'notifications', label: 'Notifications', icon: 'i-lucide-bell' },
  { value: 'security', label: 'Sécurité', icon: 'i-lucide-lock' },
  { value: 'danger', label: 'Zone dangereuse', icon: 'i-lucide-triangle-alert', danger: true },
]
</script>

<template>
  <CpAppShell :nav-items="navItems" current-nav="home" user-name="Awa" data-page="gabarit-settings">
    <CpLayoutSettings v-model:section="section" title="Réglages" description="Gérez votre organisation." :sections="sections">
      <template #section-general>
        <div class="flex flex-col gap-4">
          <h2 class="text-heading-2 text-cp-ink">Général</h2>
          <CpTextField v-model="orgName" label="Nom de l’organisation" />
          <CpTextField v-model="email" label="Adresse e-mail" type="email" />
        </div>
      </template>
      <template #section-notifications>
        <div class="flex flex-col gap-4">
          <h2 class="text-heading-2 text-cp-ink">Notifications</h2>
          <CpSwitch v-model="notifyEmail" label="Me prévenir par e-mail" />
          <CpSwitch v-model="notifyApprovals" label="Me prévenir des actions à valider" />
        </div>
      </template>
      <template #section-security>
        <div class="flex flex-col gap-4">
          <h2 class="text-heading-2 text-cp-ink">Sécurité</h2>
          <CpSwitch label="Demander un code à chaque connexion" />
        </div>
      </template>
      <template #section-danger>
        <div class="flex flex-col gap-4">
          <h2 class="text-heading-2 text-cp-danger">Zone dangereuse</h2>
          <p class="text-body text-cp-ink">Supprimer l’organisation efface toutes ses données.</p>
          <CpButton variant="danger" label="Supprimer l’organisation" class="self-start" />
        </div>
      </template>
    </CpLayoutSettings>
  </CpAppShell>
</template>
