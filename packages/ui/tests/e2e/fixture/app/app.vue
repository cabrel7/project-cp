<script setup lang="ts">
useHead({ title: 'project-cp — pages de démonstration', htmlAttrs: { lang: 'fr' } })
onMounted(() => document.documentElement.setAttribute('data-cp-hydrated', ''))

const uiLocale = useCpLocale()
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtPage />
  </UApp>
</template>
