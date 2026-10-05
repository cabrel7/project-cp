<script setup lang="ts">
// Réglage à effet immédiat. Le libellé décrit l'état ACTIVÉ (« Demander mon accord avant d'envoyer »).
const model = defineModel<boolean>({ default: false })

defineProps<{
  label: string
  disabled?: boolean
}>()
</script>

<template>
  <USwitch v-model="model" :label="label" :disabled="disabled" />
</template>
