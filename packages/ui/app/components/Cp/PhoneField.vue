<script setup lang="ts">
import { useId } from 'vue'

// Champ téléphone : sélecteur de pays (indicatif) + numéro, libellé toujours visible au-dessus.
// L'erreur remplace l'aide et s'affiche avec une icône (pas la couleur seule) ; elle est reliée
// au champ par aria-describedby. Aucune dépendance à libphonenumber : la liste des pays et la
// validation viennent de l'application (@cp/shared).
export interface CpPhoneCountry {
  code: string
  dialCode: string
  label: string
}

const model = defineModel<string>({ default: '' })
const country = defineModel<string>('country')

const props = defineProps<{
  label: string
  countries: CpPhoneCountry[]
  hint?: string
  error?: string
  disabled?: boolean
}>()

const { t } = useI18n()

const errorId = `cp-phone-error-${useId()}`
// Mobile : control-lg (48 px) ; à partir de md : control-md (40 px).
const control = 'h-(--cp-control-lg) md:h-(--cp-control-md)'

const options = computed(() =>
  props.countries.map((c) => ({ value: c.code, label: `${c.dialCode} ${c.label}` })),
)
</script>

<template>
  <UFormField :label="label" :help="error ? undefined : hint" :error="error || undefined">
    <div class="flex items-start gap-2">
      <USelect
        v-model="country"
        :items="options"
        :disabled="disabled"
        :aria-label="t('cp.auth.phone.country')"
        :class="['w-36 shrink-0', control]"
        :ui="{ base: control }"
      />
      <UInput
        v-model="model"
        type="tel"
        inputmode="tel"
        autocomplete="tel-national"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? errorId : undefined"
        :class="['min-w-0 flex-1', control]"
        :ui="{ base: control }"
      />
    </div>
    <template v-if="error" #error>
      <span :id="errorId" class="inline-flex items-center gap-1 text-cp-danger">
        <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
        <span>{{ error }}</span>
      </span>
    </template>
  </UFormField>
</template>
