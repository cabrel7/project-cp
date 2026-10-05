<script setup lang="ts">
// Métadonnées de document minimales (WCAG 2.4.2 titre de page, 3.1.1 langue) pour les tests axe.
useHead({ title: 'project-cp — pages de démonstration', htmlAttrs: { lang: 'fr' } })

// Marqueur d'hydratation pour les tests E2E (attendre les handlers Vue avant d'interagir).
onMounted(() => document.documentElement.setAttribute('data-cp-hydrated', ''))
</script>

<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
