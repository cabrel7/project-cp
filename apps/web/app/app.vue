<script setup lang="ts">
provideCpMode()
const uiLocale = useCpLocale()
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtPage />
  </UApp>
</template>
