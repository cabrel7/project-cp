<script setup lang="ts">
// Liste déroulante (plus de 4 choix ; sinon boutons radio). Libellé visible, erreur = icône + message.
export interface CpSelectOption {
  value: string
  label: string
}

const model = defineModel<string | undefined>()

defineProps<{
  label: string
  options: CpSelectOption[]
  help?: string
  error?: string
  placeholder?: string
  disabled?: boolean
}>()
</script>

<template>
  <UFormField :label="label" :help="error ? undefined : help" :error="error || undefined">
    <USelect
      v-model="model"
      :items="options"
      :placeholder="placeholder"
      :disabled="disabled"
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
