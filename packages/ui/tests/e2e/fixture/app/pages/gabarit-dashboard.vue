<script setup lang="ts">
const items = useClientNav()
</script>

<template>
  <CpAppShell :nav-items="items" current-nav="home" credits-label="12 480 crédits" user-name="Awa" data-page="gabarit-dashboard">
    <CpLayoutDashboard title="Bonjour Awa" description="Voici ce qui s'est passé aujourd'hui.">
      <template #stats>
        <CpStatTile label="Tâches terminées" value="248" trend="up" trend-value="+8 %" />
        <CpStatTile label="Temps gagné" value="12 h" trend="up" trend-value="+2 h" />
        <CpStatTile label="Erreurs" value="3" trend="down" trend-value="-1" invert-trend />
        <CpStatTile label="Actions à valider" value="2" trend="flat" trend-value="stable" />
      </template>
      <template #credits>
        <CpCreditMeter :used="7200" :total="10000" label="Crédits du mois" />
      </template>
      <template #charts>
        <div
          class="flex h-64 items-center justify-center rounded-lg border border-cp-line bg-cp-surface text-body-sm text-cp-ink-muted"
        >
          Activité sur 30 jours
        </div>
        <div
          class="flex h-64 items-center justify-center rounded-lg border border-cp-line bg-cp-surface text-body-sm text-cp-ink-muted"
        >
          Répartition par assistant
        </div>
      </template>
      <template #todo>
        <ul class="flex flex-col gap-2 rounded-lg border border-cp-line bg-cp-surface p-4 text-body text-cp-ink">
          <li>Valider l'envoi de 12 relances</li>
          <li>Renouveler la clé du système de facturation</li>
        </ul>
      </template>
    </CpLayoutDashboard>
  </CpAppShell>
</template>
