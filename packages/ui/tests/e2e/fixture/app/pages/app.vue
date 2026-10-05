<script setup lang="ts">
const items = useClientNav({ docsUrl: 'https://docs.example.com' })
const current = ref('home')
const log = ref<string[]>([])

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
