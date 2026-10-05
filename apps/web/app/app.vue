<script setup lang="ts">
const uiLocale = useCpLocale()
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtPage />
  </UApp>
</template>
