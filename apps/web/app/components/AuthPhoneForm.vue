<script setup lang="ts">
import type { PhoneCountry } from '@cp/shared'
import { safeNextPath } from '@cp/shared/safe-next'
import { AuthError } from '../composables/useAuth'
import { authErrorKey, authErrorParams, isPhoneValidationError } from '../utils/authErrors'
import { formatWait, missingDigits, phoneReasonKey } from '../utils/phoneAuth'

// Formulaire « Recevoir un code » partagé entre connexion et inscription (P2.2).
// libphonenumber-js (via @cp/shared/phone) est chargé en différé, avec l'onglet Téléphone seulement.
const props = defineProps<{ mode: 'login' | 'register'; next?: string }>()

type PhoneLib = typeof import('@cp/shared/phone')

const { t, locale } = useI18n()
const { requestCode, isLoading, isOnline } = usePhoneAuth()

const lib = shallowRef<PhoneLib | null>(null)
const country = ref<string>('CM')
const phone = ref('')
const fullName = ref('')
const acceptTerms = ref(false)
const touched = ref(false)
const submitError = ref<AuthError | null>(null)

onMounted(async () => {
  lib.value = await import('@cp/shared/phone')
})

function regionName(code: string): string {
  try {
    return new Intl.DisplayNames([locale.value], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

const countries = computed(() =>
  (lib.value?.SUPPORTED_PHONE_COUNTRIES ?? []).map((code) => ({
    code,
    dialCode: lib.value?.getPhoneDialCode(code) ?? '',
    label: code,
  })),
)

const dialCode = computed(() => lib.value?.getPhoneDialCode(country.value as PhoneCountry) ?? '')

const result = computed(() =>
  lib.value && phone.value.trim()
    ? lib.value.normalizePhone(phone.value, country.value as PhoneCountry)
    : null,
)

// Erreur sous le champ : « il manque un chiffre » seulement une fois le champ quitté (pas pendant la frappe).
const fieldError = computed<string | undefined>(() => {
  const server = submitError.value
  if (server && isPhoneValidationError(server)) {
    const { params, plural } = authErrorParams(server, { countryName: regionName(country.value) })
    return t(authErrorKey(server), params, plural ?? 1)
  }
  const r = result.value
  if (!r || r.ok) return undefined
  if (r.reason === 'TOO_SHORT') {
    if (!touched.value) return undefined
    if (r.expectedLength === undefined) return t(phoneReasonKey('INVALID'))
    const count = missingDigits(phone.value, dialCode.value, r.expectedLength)
    return t(
      'cp.auth.phone.errors.tooShort',
      { country: regionName(country.value), n: r.expectedLength, count },
      count,
    )
  }
  return t(phoneReasonKey(r.reason))
})

const canSubmit = computed(
  () =>
    result.value?.ok === true &&
    isOnline.value &&
    !isLoading.value &&
    (props.mode === 'login' || acceptTerms.value),
)

const isSmsUnavailable = computed(() => submitError.value?.code === 'AUTH_SMS_UNAVAILABLE')
const isRateLimited = computed(() => submitError.value !== null && submitError.value.status === 429)
const alertText = computed<string | null>(() => {
  const err = submitError.value
  if (!err || isPhoneValidationError(err)) return null
  if (isRateLimited.value && err.retryAfterSeconds) {
    return t('cp.auth.rateLimitedIn', { time: formatWait(err.retryAfterSeconds, t) })
  }
  return t(authErrorKey(err), authErrorParams(err).params)
})

watch([phone, country], () => {
  submitError.value = null
})

async function onSubmit() {
  const r = result.value
  touched.value = true
  if (!r?.ok || !canSubmit.value) return
  submitError.value = null
  try {
    await requestCode({
      e164: r.e164,
      country: r.country,
      intent: props.mode,
      ...(props.mode === 'register' && fullName.value.trim()
        ? { fullName: fullName.value.trim() }
        : {}),
    })
    // `next` (page demandée ou écran de liaison Google) suit jusqu'à l'écran du code ; filtré par safeNextPath.
    const target = props.next ? safeNextPath(props.next) : '/'
    await navigateTo(
      target === '/' ? '/auth/phone/code' : `/auth/phone/code?next=${encodeURIComponent(target)}`,
    )
  } catch (e) {
    submitError.value = e instanceof AuthError ? e : new AuthError('UNKNOWN', 0)
  }
}
</script>

<template>
  <form class="flex flex-col gap-5" novalidate data-testid="auth-phone-form" @submit.prevent="onSubmit">
    <UAlert
      v-if="!isOnline"
      color="warning"
      variant="subtle"
      icon="i-lucide-wifi-off"
      :title="t('cp.auth.offline')"
      role="alert"
      data-testid="auth-offline"
    />
    <UAlert
      v-if="alertText"
      :color="isSmsUnavailable || isRateLimited ? 'warning' : 'error'"
      variant="subtle"
      :icon="isRateLimited ? 'i-lucide-clock' : 'i-lucide-circle-alert'"
      :title="alertText"
      role="alert"
      data-testid="auth-phone-alert"
    >
      <template v-if="isSmsUnavailable" #actions>
        <UButton
          :to="mode === 'login' ? '/auth/login' : '/auth/register'"
          color="neutral"
          variant="outline"
          size="lg"
          :label="t('cp.auth.code.useEmail')"
        />
      </template>
    </UAlert>

    <CpTextField
      v-if="mode === 'register'"
      v-model="fullName"
      :label="t('cp.auth.register.fullName')"
      autocomplete="name"
    />

    <CpPhoneField
      v-model="phone"
      v-model:country="country"
      :label="t('cp.auth.phone.label')"
      :countries="countries"
      :hint="mode === 'login' ? t('cp.auth.phone.hintLogin') : t('cp.auth.phone.hintRegister')"
      :error="fieldError"
      :disabled="!lib"
      @focusout="touched = true"
    />

    <AuthCheckbox v-if="mode === 'register'" v-model="acceptTerms">
        <i18n-t keypath="cp.auth.register.terms" tag="span">
          <template #terms>
            <NuxtLink to="/legal/terms" class="text-cp-primary hover:underline">{{ t('cp.auth.register.termsLink') }}</NuxtLink>
          </template>
          <template #privacy>
            <NuxtLink to="/legal/privacy" class="text-cp-primary hover:underline">{{ t('cp.auth.register.privacyLink') }}</NuxtLink>
          </template>
        </i18n-t>
      </AuthCheckbox>

    <UButton
      type="submit"
      size="lg"
      block
      :loading="isLoading"
      :disabled="!canSubmit"
      :label="t('cp.auth.phone.submit')"
      data-testid="auth-phone-submit"
    />
  </form>
</template>
