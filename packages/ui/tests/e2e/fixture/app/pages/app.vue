<script setup lang="ts">
const current = ref('home')
const log = ref<string[]>([])
const items = [
  { label: 'Accueil', icon: 'i-lucide-house', value: 'home' },
  { label: 'Assistants', icon: 'i-lucide-bot', value: 'agents', group: 'Construire' },
  {
    label: 'Systèmes connectés',
    icon: 'i-lucide-plug',
    value: 'connectors',
    group: 'Construire',
    badge: 2,
  },
  { label: 'Activité', icon: 'i-lucide-play', value: 'activity', group: 'Suivre' },
]
function nav(v: string) {
  current.value = v
  log.value.push(`nav:${v}`)
}
</script>

<template>
  <CpAppShell
    :nav-items="items"
    :current-nav="current"
    credits-label="12 480 crédits"
    :notification-count="3"
    user-name="Awa"
    @navigate="nav"
    @search="log.push('search')"
    @notifications="log.push('notifications')"
    @profile="log.push('profile')"
  >
    <template #sidebar-bottom>
      <CpOrgSelector org-name="Atelier Douala" org-initials="AD" plan-label="Formule Starter" @switch="log.push('switch-org')" />
    </template>
    <h1 class="text-heading-1">Page : {{ current }}</h1>
    <p data-testid="log">{{ log.join(',') }}</p>
  </CpAppShell>
</template>
