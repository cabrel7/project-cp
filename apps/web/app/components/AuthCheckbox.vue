<script setup lang="ts">
// Case à cocher dont toute la ligne est cliquable (≥ 44 px de haut) : la case seule ne fait que 16 px.
// Les liens placés dans le libellé gardent leur propre clic.
const model = defineModel<boolean>({ default: false })
</script>

<template>
  <label class="flex min-h-11 cursor-pointer items-center gap-3 text-body text-cp-ink">
    <UCheckbox v-model="model" />
    <span class="min-w-0 flex-1"><slot /></span>
  </label>
</template>
