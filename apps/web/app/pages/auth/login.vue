<script setup lang="ts">
// Connexion par e-mail ou par téléphone + code SMS (maquettes 01 et 05). Google : bouton piloté par /v1/auth/methods ;
// clé d'accès et Apple masqués jusqu'à P8.8 (D67).
import { safeNextPath } from '@cp/shared/safe-next'

definePageMeta({ layout: false })

const { t } = useI18n()
const { login, isLoading } = useAuth()

const email = ref('')
const password = ref('')
const rememberMe = ref(true)
const route = useRoute()
const errorKey = ref<string | null>(null)

// Retour du rappel Google : `?error=<CODE>[&reason=cancelled]` (liste blanche) et `?link=google` (compte existant).
const queryError = computed(() => queryErrorKey(route.query.error, route.query.reason))
const linkPending = computed(() => route.query.link === 'google')
// Après la connexion : page demandée, ou l'écran de liaison quand un compte existait déjà pour l'e-mail Google.
const next = computed(() =>
  safeNextPath(route.query.next, linkPending.value ? '/auth/link-account' : '/'),
)

const tabs = computed(() => [
  { label: t('cp.auth.login.tabEmail'), value: 'email' },
  { label: t('cp.auth.login.tabPhone'), value: 'phone' },
])
const tab = useAuthTab()

async function onSubmit() {
  errorKey.value = null
  try {
    await login(email.value.trim(), password.value, rememberMe.value, next.value)
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

    <CpAlert
      v-if="linkPending"
      variant="info"
      :title="t('cp.auth.social.accountExists')"
      data-testid="auth-link-info"
    />
    <CpAlert
      v-if="queryError"
      variant="danger"
      :title="t(queryError)"
      data-testid="auth-query-error"
    />

    <AuthMethodTabs v-model="tab" :items="tabs" />

    <template v-if="tab === 'email'">
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
        <AuthCheckbox v-model="rememberMe">{{ t('cp.auth.login.rememberMe') }}</AuthCheckbox>
        <UButton
          type="submit"
          size="lg"
          block
          :loading="isLoading"
          :disabled="!email || !password"
          :label="t('cp.auth.login.submit')"
        />
      </form>
    </template>
    <LazyAuthPhoneForm v-else mode="login" :next="next" />

    <AuthSocialButtons :next="next" :remember-me="rememberMe" />

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
