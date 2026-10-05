<script setup lang="ts">
// Sections d'une page de détail (G2) : 2 à 5 onglets, onglet actif en primary souligné.
// Le contenu n'est pas géré ici (content=false) : la page route selon la valeur (URL).
export interface CpTabItem {
  label: string
  value: string
  badge?: number
}

const model = defineModel<string>({ required: true })

defineProps<{ items: CpTabItem[] }>()
</script>

<template>
  <UTabs
    v-model="model"
    :items="items"
    :content="false"
    variant="link"
    color="primary"
    :ui="{ trigger: 'text-label' }"
  />
</template>
