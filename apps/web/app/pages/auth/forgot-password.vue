<script setup lang="ts">
// Mot de passe oublié (maquette 07) : gabarit centré. Réponse volontairement identique que le compte existe ou non.
definePageMeta({ layout: false })

const { t } = useI18n()
const { forgotPassword, isLoading } = useAuth()

const email = ref('')
const sent = ref(false)
const errorKey = ref<string | null>(null)

async function send() {
  errorKey.value = null
  try {
    await forgotPassword(email.value.trim())
    sent.value = true
  } catch (e) {
    errorKey.value = authErrorKey(e)
  }
}

useHead({ title: () => t('cp.auth.forgot.title') })
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-cp-canvas p-4 text-cp-ink">
    <main class="flex w-full max-w-md flex-col gap-6">
      <NuxtLink
        to="/auth/login"
        class="inline-flex min-h-11 items-center gap-2 self-start text-label text-cp-primary hover:underline"
      >
        <UIcon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" />
        {{ t('cp.auth.forgot.back') }}
      </NuxtLink>

      <header class="flex flex-col gap-3">
        <span class="flex size-14 items-center justify-center rounded-xl bg-cp-primary-soft text-cp-primary">
          <UIcon name="i-lucide-lock" class="size-7" aria-hidden="true" />
        </span>
        <h1 class="font-display text-heading-1 text-cp-ink">{{ t('cp.auth.forgot.title') }}</h1>
        <p class="text-body text-cp-ink-muted">{{ t('cp.auth.forgot.description') }}</p>
      </header>

      <UAlert
        v-if="errorKey"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="t(errorKey)"
        role="alert"
      />

      <form class="flex flex-col gap-5" novalidate @submit.prevent="send">
        <CpTextField v-model="email" type="email" :label="t('cp.auth.forgot.email')" required />
        <UButton
          v-if="!sent"
          type="submit"
          size="xl"
          block
          :loading="isLoading"
          :disabled="!email"
          :label="t('cp.auth.forgot.submit')"
        />
      </form>

      <template v-if="sent">
        <UAlert
          color="success"
          variant="subtle"
          icon="i-lucide-circle-check"
          :title="t('cp.auth.forgot.sent')"
          :description="t('cp.auth.forgot.sentDetail')"
          role="status"
        />
        <div class="flex flex-col gap-3 sm:flex-row">
          <UButton
            color="neutral"
            variant="outline"
            size="xl"
            block
            :loading="isLoading"
            :label="t('cp.auth.forgot.resend')"
            @click="send"
          />
          <UButton
            size="xl"
            block
            to="mailto:"
            external
            icon="i-lucide-mail"
            :label="t('cp.auth.forgot.openMail')"
          />
        </div>
      </template>
    </main>
  </div>
</template>
