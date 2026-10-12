<script setup lang="ts">
import { AuthError } from '../../../composables/useAuth'
import { authErrorKey, authErrorParams } from '../../../utils/authErrors'
import { formatClock, formatWait } from '../../../utils/phoneAuth'

// Saisie du code SMS (maquette 06). Gabarit d'entrée : une colonne sur mobile, panneau illustré sur desktop.
// Sans demande de code en cours (accès direct), on revient à la saisie du numéro.
definePageMeta({ layout: false })

const CODE_LENGTH = 6
const VALIDITY_MINUTES = 5

const { t } = useI18n()
const {
  request,
  isLoading,
  isOnline,
  resendSeconds,
  canResend,
  restore,
  verifyCode,
  resend,
  cancel,
} = usePhoneAuth()

const backTo = computed(() =>
  request.value?.intent === 'register' ? '/auth/register?tab=phone' : '/auth/login?tab=phone',
)
const emailTo = computed(() =>
  request.value?.intent === 'register' ? '/auth/register' : '/auth/login',
)

const digits = ref<number[]>([])
const code = computed(() => digits.value.join(''))
const isComplete = computed(() => new RegExp(`^[0-9]{${CODE_LENGTH}}$`).test(code.value))
const error = ref<AuthError | null>(null)
const resentNotice = ref(false)
const masked = ref('')
const pin = useTemplateRef<{ inputsRef: { $el?: HTMLInputElement }[] }>('pin')

const errorCode = computed(() => error.value?.code)
// Code périmé ou essais épuisés : on ne peut plus saisir, il faut en demander un nouveau.
const isEnded = computed(
  () => errorCode.value === 'AUTH_OTP_EXPIRED' || errorCode.value === 'AUTH_OTP_ATTEMPTS_EXCEEDED',
)
const isInvalid = computed(() => errorCode.value === 'AUTH_OTP_INVALID')
const isSmsUnavailable = computed(() => errorCode.value === 'AUTH_SMS_UNAVAILABLE')
const isRateLimited = computed(() => error.value?.status === 429)

const invalidMessage = computed(() => {
  if (!error.value || !isInvalid.value) return ''
  const { params, plural } = authErrorParams(error.value)
  return t(authErrorKey(error.value), params, plural ?? 1)
})
const alertText = computed(() => {
  const err = error.value
  if (!err || isInvalid.value) return ''
  if (isRateLimited.value && err.retryAfterSeconds) {
    return t('cp.auth.rateLimitedIn', { time: formatWait(err.retryAfterSeconds, t) })
  }
  return t(authErrorKey(err))
})

const canVerify = computed(() => isComplete.value && isOnline.value && !isLoading.value)
const canRequestNew = computed(() => isOnline.value && !isLoading.value)

function focusFirst() {
  nextTick(() => pin.value?.inputsRef?.[0]?.$el?.focus())
}

onMounted(async () => {
  if (!restore()) {
    await navigateTo('/auth/login?tab=phone', { replace: true })
    return
  }
  // Un champ par chiffre : étiquette propre à chaque case (« Chiffre n sur 6 »).
  nextTick(() => {
    pin.value?.inputsRef?.forEach((input, i) => {
      input.$el?.setAttribute('aria-label', t('cp.auth.code.digit', { n: i + 1 }))
    })
    focusFirst()
  })
  const { maskPhone } = await import('@cp/shared/phone')
  if (request.value) masked.value = maskPhone(request.value.e164)
})

async function onVerify() {
  if (!canVerify.value || isEnded.value) return
  error.value = null
  resentNotice.value = false
  try {
    await verifyCode(code.value)
  } catch (e) {
    error.value = e instanceof AuthError ? e : new AuthError('UNKNOWN', 0)
    if (error.value.code === 'AUTH_OTP_INVALID') {
      digits.value = []
      focusFirst()
    }
  }
}

async function onRequestNew() {
  if (!canRequestNew.value) return
  error.value = null
  try {
    await resend()
    digits.value = []
    resentNotice.value = true
    focusFirst()
  } catch (e) {
    error.value = e instanceof AuthError ? e : new AuthError('UNKNOWN', 0)
  }
}

// Dès que l'on retape un chiffre, le message d'erreur précédent n'a plus lieu d'être.
watch(digits, (value) => {
  if (isInvalid.value && value.length > 0) error.value = null
})

// Envoi automatique dès que les 6 chiffres sont saisis (le bouton « Vérifier » reste disponible).
watch(isComplete, (complete) => {
  if (complete) onVerify()
})

// Annonce unique (lecteur d'écran) quand le renvoi devient possible ; le compte à rebours lui-même reste muet.
const resendAnnounce = ref('')
watch(canResend, (ready, was) => {
  if (ready && was === false) resendAnnounce.value = t('cp.auth.code.resendReady')
})

useHead({ title: () => t('cp.auth.code.title') })
</script>

<template>
  <CpLayoutLogin :tagline="t('cp.auth.login.tagline')" :subtitle="t('cp.auth.login.taglineSub')">
    <template v-if="request">
      <NuxtLink
        :to="backTo"
        class="-ml-2 inline-flex min-h-11 w-fit items-center gap-2 rounded-md px-2 text-label text-cp-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cp-primary"
        data-testid="auth-code-back"
        @click="cancel"
      >
        <UIcon name="i-lucide-arrow-left" class="size-5" aria-hidden="true" />
        {{ t('cp.auth.code.back') }}
      </NuxtLink>

      <span class="flex size-12 items-center justify-center rounded-xl bg-cp-primary-soft text-cp-primary">
        <UIcon name="i-lucide-smartphone" class="size-6" aria-hidden="true" />
      </span>

      <header class="flex flex-col gap-2">
        <h1 class="font-display text-heading-1 text-cp-ink">{{ t('cp.auth.code.title') }}</h1>
        <p class="text-body text-cp-ink-muted" data-testid="auth-code-sent-to">
          <i18n-t keypath="cp.auth.code.sentTo" tag="span">
            <template #phone>
              <strong class="font-semibold text-cp-ink">{{ masked || '…' }}</strong>
            </template>
          </i18n-t>
          {{ ' ' }}
          <NuxtLink
            :to="backTo"
            class="inline-flex min-h-11 items-center px-1 text-cp-primary underline-offset-2 hover:underline"
            @click="cancel"
          >
            {{ t('cp.auth.code.change') }}
          </NuxtLink>
        </p>
      </header>

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
        :color="isEnded || isSmsUnavailable || isRateLimited ? 'warning' : 'error'"
        variant="subtle"
        :icon="isRateLimited ? 'i-lucide-clock' : 'i-lucide-circle-alert'"
        :title="alertText"
        role="alert"
        data-testid="auth-code-alert"
      >
        <template v-if="isSmsUnavailable" #actions>
          <UButton
            :to="emailTo"
            color="neutral"
            variant="outline"
            size="lg"
            :label="t('cp.auth.code.useEmail')"
            @click="cancel"
          />
        </template>
      </UAlert>

      <form class="flex flex-col gap-6 pb-28 lg:pb-0" novalidate @submit.prevent="onVerify">
        <div
          class="flex flex-col gap-2"
          role="group"
          aria-labelledby="cp-code-label"
          :aria-invalid="isInvalid ? 'true' : undefined"
          :aria-describedby="isInvalid ? 'cp-code-error' : undefined"
        >
          <span id="cp-code-label" class="text-label text-cp-ink">{{ t('cp.auth.code.label') }}</span>
          <UPinInput
            ref="pin"
            v-model="digits"
            :length="CODE_LENGTH"
            otp
            type="number"
            size="xl"
            :color="isInvalid ? 'error' : 'primary'"
            :highlight="isInvalid"
            :disabled="isEnded || isLoading"
            class="w-full justify-between"
            :ui="{ base: 'size-(--cp-control-lg) text-center tabular-nums !text-heading-1' }"
            data-testid="auth-code-input"
          />
          <p
            id="cp-code-error"
            class="min-h-5 text-body-sm text-cp-danger"
            aria-live="assertive"
            data-testid="auth-code-invalid"
          >
            <span v-if="invalidMessage" class="inline-flex items-center gap-1">
              <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
              {{ invalidMessage }}
            </span>
          </p>
        </div>

        <div class="flex flex-col items-start gap-1">
          <p v-if="!canResend" class="text-body text-cp-ink-muted" aria-live="off" data-testid="auth-code-resend-in">
            {{ t('cp.auth.code.resendIn', { time: formatClock(resendSeconds) }) }}
          </p>
          <UButton
            v-else
            type="button"
            color="neutral"
            variant="link"
            size="lg"
            class="-ml-2 min-h-11"
            :disabled="!canRequestNew"
            :label="t('cp.auth.code.resend')"
            data-testid="auth-code-resend"
            @click="onRequestNew"
          />
          <p class="sr-only" role="status">{{ resendAnnounce }}</p>
          <p v-if="resentNotice" class="text-body-sm text-cp-success" role="status" data-testid="auth-code-resent">
            {{ t('cp.auth.code.resent') }}
          </p>
        </div>

        <CpAlert variant="tip" :title="t('cp.auth.code.validity', { minutes: VALIDITY_MINUTES })" />

        <!-- Mobile : bouton collant en bas, au-dessus de la zone sûre ; desktop : dans le flux. -->
        <div
          class="fixed inset-x-0 bottom-0 border-t border-cp-line bg-cp-canvas px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static lg:border-0 lg:bg-transparent lg:p-0"
        >
          <UButton
            v-if="isEnded"
            type="button"
            size="lg"
            block
            :loading="isLoading"
            :disabled="!canRequestNew"
            :label="t('cp.auth.code.requestNew')"
            data-testid="auth-code-request-new"
            @click="onRequestNew"
          />
          <UButton
            v-else
            type="submit"
            size="lg"
            block
            :loading="isLoading"
            :disabled="!canVerify"
            :label="t('cp.auth.code.submit')"
            data-testid="auth-code-submit"
          />
        </div>
      </form>
    </template>
  </CpLayoutLogin>
</template>
