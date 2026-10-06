<script setup lang="ts">
// Connexion par e-mail (maquette 01). Téléphone, clé d'accès, Google et Apple : P2.2+ (désactivés).
definePageMeta({ layout: false })

const { t } = useI18n()
const { login, isLoading } = useAuth()

const email = ref('')
const password = ref('')
const rememberMe = ref(true)
const errorKey = ref<string | null>(null)

const tabs = computed(() => [
  { label: t('cp.auth.login.tabEmail'), value: 'email', icon: 'i-lucide-mail' },
  { label: t('cp.auth.login.tabPhone'), value: 'phone', icon: 'i-lucide-phone', disabled: true },
])
const tab = ref('email')

async function onSubmit() {
  errorKey.value = null
  try {
    await login(email.value.trim(), password.value, rememberMe.value)
  } catch (e) {
    errorKey.value = authErrorKey(e)
  }
}

useHead({ title: () => t('cp.auth.login.title') })
</script>

<template>
  <CpLayoutLogin :tagline="t('cp.auth.login.tagline')" :subtitle="t('cp.auth.login.taglineSub')">
    <header class="flex flex-col gap-2">
      <h1 class="font-display text-heading-1 text-cp-ink">{{ t('cp.auth.login.title') }}</h1>
      <p class="text-body text-cp-ink-muted">
        {{ t('cp.auth.login.subtitle') }}
        <NuxtLink to="/auth/register" class="text-cp-primary underline-offset-2 hover:underline">
          {{ t('cp.auth.login.createAccount') }}
        </NuxtLink>
      </p>
    </header>

    <UTabs v-model="tab" :items="tabs" :content="false" variant="pill" color="primary" class="w-full" />

    <UAlert
      v-if="errorKey"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="t(errorKey)"
      role="alert"
    />

    <form class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
      <CpTextField
        v-model="email"
        type="email"
        :label="t('cp.auth.login.email')"
        autocomplete="email"
        required
      />
      <AuthPasswordField
        v-model="password"
        :label="t('cp.auth.login.password')"
        autocomplete="current-password"
        required
      >
        <template #hint>
          <NuxtLink to="/auth/forgot-password" class="text-cp-primary underline-offset-2 hover:underline">
            {{ t('cp.auth.login.forgotPassword') }}
          </NuxtLink>
        </template>
      </AuthPasswordField>
      <UCheckbox v-model="rememberMe" :label="t('cp.auth.login.rememberMe')" />
      <UButton
        type="submit"
        size="xl"
        block
        :loading="isLoading"
        :disabled="!email || !password"
        :label="t('cp.auth.login.submit')"
      />
    </form>

    <USeparator :label="t('cp.auth.login.or')" />

    <div class="flex flex-col gap-3">
      <UButton
        color="neutral"
        variant="outline"
        size="xl"
        block
        disabled
        icon="i-lucide-key-round"
        :label="t('cp.auth.login.passkey')"
        :title="t('cp.auth.comingSoon')"
      />
      <div class="grid grid-cols-2 gap-3">
        <UButton color="neutral" variant="outline" size="xl" block disabled label="Google" :title="t('cp.auth.comingSoon')" />
        <UButton color="neutral" variant="outline" size="xl" block disabled label="Apple" :title="t('cp.auth.comingSoon')" />
      </div>
    </div>

    <i18n-t keypath="cp.auth.login.legal" tag="p" class="text-center text-body-sm text-cp-ink-muted">
      <template #terms>
        <NuxtLink to="/legal/terms" class="text-cp-primary hover:underline">{{ t('cp.auth.login.terms') }}</NuxtLink>
      </template>
      <template #privacy>
        <NuxtLink to="/legal/privacy" class="text-cp-primary hover:underline">{{ t('cp.auth.login.privacy') }}</NuxtLink>
      </template>
    </i18n-t>
  </CpLayoutLogin>
</template>
