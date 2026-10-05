<script setup lang="ts">
const items = useClientNav()
const search = ref('')
const rows = [
  { name: 'Assistant facturation', status: 'Actif' },
  { name: 'Assistant relances', status: 'En pause' },
  { name: 'Assistant stock', status: 'Brouillon' },
]
</script>

<template>
  <CpAppShell :nav-items="items" current-nav="agents" credits-label="12 480 crédits" user-name="Awa" data-page="gabarit-list">
    <CpLayoutList
      v-model:search="search"
      title="Assistants"
      description="Les assistants qui travaillent pour vous."
      :breadcrumbs="[{ label: 'Accueil', to: '/' }, { label: 'Assistants' }]"
      :active-filter-count="2"
    >
      <template #actions>
        <CpButton label="Créer un assistant" icon="i-lucide-plus" />
      </template>
      <ul class="divide-y divide-cp-line rounded-lg border border-cp-line bg-cp-surface">
        <li v-for="row in rows" :key="row.name" class="flex items-center justify-between p-4 text-body text-cp-ink">
          <span>{{ row.name }}</span>
          <span class="text-body-sm text-cp-ink-muted">{{ row.status }}</span>
        </li>
      </ul>
      <template #mobile-cards>
        <div class="flex flex-col gap-3">
          <article
            v-for="row in rows"
            :key="row.name"
            class="flex flex-col gap-1 rounded-lg border border-cp-line bg-cp-surface p-4"
          >
            <h3 class="text-heading-3 text-cp-ink">{{ row.name }}</h3>
            <p class="text-body-sm text-cp-ink-muted">{{ row.status }}</p>
          </article>
        </div>
      </template>
    </CpLayoutList>
  </CpAppShell>
</template>
