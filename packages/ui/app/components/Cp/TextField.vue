<script setup lang="ts">
// Champ de saisie : libellé toujours visible au-dessus (jamais un placeholder seul),
// l'erreur remplace l'aide et s'affiche avec une icône (pas la couleur seule).
const model = defineModel<string | number | undefined>()

withDefaults(
  defineProps<{
    label: string
    help?: string
    error?: string
    type?: 'text' | 'email' | 'tel' | 'number'
    placeholder?: string
    disabled?: boolean
    required?: boolean
    autocomplete?: string
    inputmode?: 'text' | 'email' | 'tel' | 'numeric' | 'search' | 'url' | 'none'
  }>(),
  { type: 'text' },
)
</script>

<template>
  <UFormField
    :label="label"
    :help="error ? undefined : help"
    :error="error || undefined"
    :required="required"
  >
    <UInput
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :autocomplete="autocomplete"
      :inputmode="inputmode"
      class="w-full"
    />
    <template v-if="error" #error>
      <span class="inline-flex items-center gap-1 text-cp-danger">
        <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
        <span>{{ error }}</span>
      </span>
    </template>
  </UFormField>
</template>
