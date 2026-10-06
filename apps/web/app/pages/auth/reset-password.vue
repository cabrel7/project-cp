<script setup lang="ts">
// Nouveau mot de passe (maquette 08) : gabarit centré avec logo. Jeton dans ?token=...
definePageMeta({ layout: false })

const { t } = useI18n()
const route = useRoute()
const { resetPassword, isLoading } = useAuth()

const token = computed(() => {
  const raw = route.query.token
  return typeof raw === 'string' ? raw : ''
})

const password = ref('')
const confirm = ref('')
const revokeSessions = ref(true)
const errorKey = ref<string | null>(token.value ? null : 'cp.auth.reset.invalidToken')
const done = ref(false)

const mismatch = computed(() => confirm.value.length > 0 && confirm.value !== password.value)
const canSubmit = computed(
  () => !!token.value && password.value.length >= 8 && confirm.value === password.value,
)

async function onSubmit() {
  if (!canSubmit.value) return
  errorKey.value = null
  try {
    await resetPassword(token.value, password.value, revokeSessions.value)
    done.value = true
  } catch (e) {
    errorKey.value = authErrorKey(e)
  }
}

useHead({ title: () => t('cp.auth.reset.title') })
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-cp-canvas p-4 text-cp-ink">
    <main class="flex w-full max-w-md flex-col gap-6">
      <div class="flex items-center gap-3">
        <span class="flex size-10 items-center justify-center rounded-md bg-cp-brand-violet text-cp-on-primary">
          <UIcon name="i-lucide-workflow" class="size-6" aria-hidden="true" />
        </span>
        <span class="font-display text-heading-3 text-cp-ink">project-cp</span>
      </div>

      <h1 class="font-display text-heading-1 text-cp-ink">{{ t('cp.auth.reset.title') }}</h1>

      <template v-if="done">
        <UAlert
          color="success"
          variant="subtle"
          icon="i-lucide-circle-check"
          :title="t('cp.auth.reset.success')"
          role="status"
        />
        <UButton to="/auth/login" size="xl" block :label="t('cp.auth.verify.goToLogin')" />
      </template>

      <template v-else>
        <UAlert
          v-if="errorKey"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="t(errorKey)"
          :actions="[{ label: t('cp.auth.reset.requestNewLink'), to: '/auth/forgot-password', color: 'neutral', variant: 'outline' }]"
          role="alert"
        />

        <form class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
          <div class="flex flex-col gap-2">
            <AuthPasswordField
              v-model="password"
              :label="t('cp.auth.reset.newPassword')"
              autocomplete="new-password"
              required
            />
            <CpPasswordStrength :password="password" />
          </div>
          <AuthPasswordField
            v-model="confirm"
            :label="t('cp.auth.reset.confirmPassword')"
            autocomplete="new-password"
            :error="mismatch ? t('cp.auth.reset.passwordMismatch') : undefined"
            required
          />
          <UCheckbox v-model="revokeSessions" :label="t('cp.auth.reset.revokeSessions')" />
          <UButton
            type="submit"
            size="xl"
            block
            :loading="isLoading"
            :disabled="!canSubmit"
            :label="t('cp.auth.reset.submit')"
          />
        </form>
      </template>
    </main>
  </div>
</template>
