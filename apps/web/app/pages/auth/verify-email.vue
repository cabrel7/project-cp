<script setup lang="ts">
// Vérification de l'e-mail : le jeton (?token=...) est soumis automatiquement à l'ouverture de la page.
definePageMeta({ layout: false })

const { t } = useI18n()
const route = useRoute()
const { verifyEmail } = useAuth()

const status = ref<'loading' | 'success' | 'error'>('loading')

onMounted(async () => {
  const raw = route.query.token
  const token = typeof raw === 'string' ? raw : ''
  if (!token) {
    status.value = 'error'
    return
  }
  try {
    await verifyEmail(token)
    status.value = 'success'
  } catch {
    status.value = 'error'
  }
})

useHead({ title: () => t('cp.auth.verify.title') })
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-cp-canvas p-4 text-cp-ink">
    <main class="flex w-full max-w-md flex-col gap-6" aria-live="polite">
      <h1 class="font-display text-heading-1 text-cp-ink">{{ t('cp.auth.verify.title') }}</h1>

      <p v-if="status === 'loading'" class="flex items-center gap-2 text-body text-cp-ink-muted">
        <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {{ t('cp.auth.verify.loading') }}
      </p>

      <UAlert
        v-else-if="status === 'success'"
        color="success"
        variant="subtle"
        icon="i-lucide-circle-check"
        :title="t('cp.auth.verify.success')"
        role="status"
      />

      <UAlert
        v-else
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="t('cp.auth.verify.error')"
        role="alert"
      />

      <UButton
        v-if="status !== 'loading'"
        to="/auth/login"
        size="xl"
        block
        :label="t('cp.auth.verify.goToLogin')"
      />
    </main>
  </div>
</template>
