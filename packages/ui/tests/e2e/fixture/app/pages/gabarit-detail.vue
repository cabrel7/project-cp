<script setup lang="ts">
const tab = ref('overview')
const navItems = [
  { label: 'Accueil', icon: 'i-lucide-house', value: 'home' },
  { label: 'Assistants', icon: 'i-lucide-bot', value: 'agents', group: 'Construire' },
]
const tabs = [
  { label: 'Vue d’ensemble', value: 'overview' },
  { label: 'Activité', value: 'activity' },
  { label: 'Réglages', value: 'settings' },
]
</script>

<template>
  <CpAppShell :nav-items="navItems" current-nav="agents" user-name="Awa" data-page="gabarit-detail">
    <CpLayoutDetail
      v-model:tab="tab"
      title="Assistant facturation"
      :breadcrumbs="[{ label: 'Assistants', to: '/gabarit-list' }, { label: 'Assistant facturation' }]"
      :tabs="tabs"
    >
      <template #status>
        <CpStatusBadge status="active" />
      </template>
      <template #actions>
        <CpButton variant="secondary" label="Modifier" />
        <CpButton label="Lancer" icon="i-lucide-play" />
      </template>
      <template #stats>
        <CpStatTile label="Exécutions ce mois" value="128" trend="up" trend-value="+12 %" />
        <CpStatTile label="Taux de réussite" value="97 %" trend="flat" trend-value="stable" />
      </template>
      <section class="rounded-lg border border-cp-line bg-cp-surface p-6 text-body text-cp-ink">
        Contenu de l’onglet « {{ tab }} ».
      </section>
      <template #aside>
        <section class="rounded-lg border border-cp-line bg-cp-surface p-4 text-body-sm text-cp-ink-muted">
          Créé par Awa le 3 mars. Dernière exécution il y a 2 heures.
        </section>
      </template>
    </CpLayoutDetail>
  </CpAppShell>
</template>
