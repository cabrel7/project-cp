<script setup lang="ts">
// Champ mot de passe avec bascule afficher/masquer ; le slot `hint` accueille le lien « Mot de passe oublié ? ».
const model = defineModel<string>({ required: true })

defineProps<{
  label: string
  autocomplete: 'current-password' | 'new-password'
  error?: string
  required?: boolean
}>()

const { t } = useI18n()
const visible = ref(false)
</script>

<template>
  <UFormField :label="label" :error="error || undefined" :required="required" class="w-full">
    <template v-if="$slots.hint" #hint>
      <slot name="hint" />
    </template>
    <UInput
      v-model="model"
      :type="visible ? 'text' : 'password'"
      :autocomplete="autocomplete"
      :required="required"
      class="w-full"
    >
      <template #trailing>
        <UButton
          type="button"
          color="neutral"
          variant="link"
          size="sm"
          :icon="visible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          :aria-label="visible ? t('cp.auth.password.hide') : t('cp.auth.password.show')"
          :aria-pressed="visible"
          @click="visible = !visible"
        />
      </template>
    </UInput>
    <template v-if="error" #error>
      <span class="inline-flex items-center gap-1 text-cp-danger">
        <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
        <span>{{ error }}</span>
      </span>
    </template>
  </UFormField>
</template>
