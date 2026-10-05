<script setup lang="ts">
const current = ref('dashboard')
const log = ref<string[]>([])
const items = [
  { label: 'Pilotage', icon: 'i-lucide-layout-dashboard', value: 'dashboard' },
  { label: 'Clients', icon: 'i-lucide-users', value: 'customers', group: 'Clients et revenus' },
  { label: 'Capacités', icon: 'i-lucide-brain', value: 'capabilities', group: 'IA', badge: 1 },
  { label: 'Audit', icon: 'i-lucide-scroll-text', value: 'audit', group: 'Confiance' },
]
function nav(v: string) {
  current.value = v
  log.value.push(`nav:${v}`)
}
</script>

<template>
  <CpAdminShell
    :nav-items="items"
    :current-nav="current"
    user-name="Dylan"
    user-role="Super-admin"
    has2fa
    environment-label="Production"
    session-time-remaining="14 min"
    @navigate="nav"
    @search="log.push('search')"
    @profile="log.push('profile')"
    @emergency-stop="log.push('emergency-stop')"
  >
    <h1 class="text-heading-1">Admin : {{ current }}</h1>
    <p data-testid="log">{{ log.join(',') }}</p>
  </CpAdminShell>
</template>
