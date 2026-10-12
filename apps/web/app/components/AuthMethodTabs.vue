<script setup lang="ts">
// Bascule E-mail | Téléphone (maquette 05) : segment neutre (surface sur surface-sunken), sans icône ;
// le seul aplat primary de l'écran reste le bouton d'action. Cibles ≥ 44 px sur mobile.
defineProps<{ items: { label: string; value: string }[] }>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <UTabs
    v-model="model"
    :items="items"
    :content="false"
    variant="pill"
    color="neutral"
    class="w-full"
    :ui="{
      list: 'rounded-lg border border-cp-line bg-cp-surface-sunken p-1',
      trigger: 'min-h-11 text-cp-ink-muted data-[state=active]:text-cp-ink md:min-h-8',
      indicator: 'rounded-md bg-cp-surface shadow-sm',
    }"
  />
</template>
