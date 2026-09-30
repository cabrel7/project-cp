<!-- Nuxt UI — UTable avec colonnes configurées et slots pour le contenu custom -->
<template>
  <UTable :rows="rows" :columns="columns" :loading="loading" @select="onRowClick">
    <template #status-data="{ row }">
      <CpStatusBadge :status="row.status" />
    </template>
    <template #credits-data="{ row }">
      <span class="text-right tabular-nums">{{ formatCredits(row.credits) }}</span>
    </template>
    <template #lastRun-data="{ row }">
      <span class="text-[var(--ink-muted)]">{{ timeAgo(row.lastRun) }}</span>
    </template>
  </UTable>
  <UPagination v-model="page" :total="total" :page-count="pageSize" />
</template>

<script setup lang="ts">
const columns = [
  { key: 'name', label: 'Nom', sortable: true },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Statut' },
  { key: 'runs', label: 'Exécutions', class: 'text-right tabular-nums' },
  { key: 'credits', label: 'Crédits', class: 'text-right tabular-nums' },
  { key: 'lastRun', label: 'Dernière exécution' },
]
</script>

<!--
  + : UTable intègre tri, sélection, chargement, vide, slots par colonne
  + : ~25 lignes pour un tableau complet
  + : UPagination fourni
  - : le système de slots de UTable est spécifique à Nuxt UI (API à apprendre)
  - : modes Simple/Technique (colonnes conditionnelles) = logique dans `columns`
  - : rendu mobile en carte = à implémenter nous-mêmes (UTable ne le gère pas)
-->
