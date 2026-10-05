<script setup lang="ts">
provideCpMode()
const uiLocale = useCpLocale()
</script>

<template>
  <UApp :locale="uiLocale">
    <h1>project-cp</h1>
  </UApp>
</template>
