<script setup lang="ts">
// Inscription par e-mail ou par téléphone (maquette 02, D63 : onglets). Google : bouton piloté par /v1/auth/methods (P2.3).
definePageMeta({ layout: false })

const { t } = useI18n()
const { register, isLoading } = useAuth()

const fullName = ref('')
const email = ref('')
const password = ref('')
const acceptTerms = ref(false)
const route = useRoute()
const errorKey = ref<string | null>(null)
const queryError = computed(() => queryErrorKey(route.query.error, route.query.reason, 'register'))
const sent = ref(false)
const tabs = computed(() => [
  { label: t('cp.auth.register.tabEmail'), value: 'email' },
  { label: t('cp.auth.register.tabPhone'), value: 'phone' },
])
const tab = useAuthTab()

const canSubmit = computed(() => !!email.value && password.value.length >= 8 && acceptTerms.value)

async function onSubmit() {
  if (!canSubmit.value) return
  errorKey.value = null
  try {
    await register(email.value.trim(), password.value, fullName.value.trim() || undefined)
    sent.value = true
  } catch (e) {
    errorKey.value = authErrorKey(e)
  }
}

useHead({ title: () => t('cp.auth.register.title') })
</script>

<template>
  <CpLayoutLogin :tagline="t('cp.auth.register.tagline')" :subtitle="t('cp.auth.register.taglineSub')">
    <header class="flex flex-col gap-2">
      <h1 class="font-display text-heading-1 text-cp-ink">{{ t('cp.auth.register.title') }}</h1>
      <p class="text-body text-cp-ink-muted">
        {{ t('cp.auth.register.subtitle') }}
        <NuxtLink to="/auth/login" class="text-cp-primary underline-offset-2 hover:underline">
          {{ t('cp.auth.register.signIn') }}
        </NuxtLink>
      </p>
    </header>

    <CpAlert
      v-if="queryError && !sent"
      :variant="queryError === 'cp.auth.social.cancelled' ? 'info' : 'danger'"
      :title="t(queryError)"
      data-testid="auth-query-error"
    />

    <AuthMethodTabs v-if="!sent" v-model="tab" :items="tabs" />

    <template v-if="sent">
      <UAlert
        color="success"
        variant="subtle"
        icon="i-lucide-circle-check"
        :title="t('cp.auth.register.sent')"
        :description="t('cp.auth.register.sentDetail')"
        role="status"
      />
      <UButton to="/auth/login" size="lg" block :label="t('cp.auth.register.goToLogin')" />
    </template>

    <template v-else-if="tab === 'email'">
      <UAlert
        v-if="errorKey"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="t(errorKey)"
        role="alert"
      />

      <form class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
        <CpTextField v-model="fullName" :label="t('cp.auth.register.fullName')" autocomplete="name" />
        <CpTextField v-model="email" type="email" :label="t('cp.auth.register.email')" autocomplete="email" required />
        <div class="flex flex-col gap-2">
          <AuthPasswordField
            v-model="password"
            :label="t('cp.auth.register.password')"
            autocomplete="new-password"
            required
          />
          <CpPasswordStrength :password="password" />
        </div>
        <AuthCheckbox v-model="acceptTerms">
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
          :label="t('cp.auth.register.submit')"
        />
      </form>
    </template>

    <LazyAuthPhoneForm v-else mode="register" />

    <template v-if="!sent">
      <AuthSocialButtons />
      <!-- Google crée le compte sans case à cocher : la mention légale de la maquette 01 couvre ce cas (H3). -->
      <i18n-t keypath="cp.auth.login.legal" tag="p" class="text-center text-body-sm text-cp-ink-muted">
        <template #terms>
          <NuxtLink to="/legal/terms" class="text-cp-primary hover:underline">{{ t('cp.auth.login.terms') }}</NuxtLink>
        </template>
        <template #privacy>
          <NuxtLink to="/legal/privacy" class="text-cp-primary hover:underline">{{ t('cp.auth.login.privacy') }}</NuxtLink>
        </template>
      </i18n-t>
    </template>
  </CpLayoutLogin>
</template>
