<script setup lang="ts">
// Section « Moyens de connexion » (G5, P2.3) : mot de passe, téléphone, Google (lier / délier).
// Réutilisée par les sections suivantes de la page Sécurité (P8.8). Une seule action principale : « Lier Google ».
import { AuthError, type AuthUser } from '../composables/useAuth'
import { authErrorKey } from '../utils/authErrors'

const props = defineProps<{
  user: AuthUser
  /** Message du retour de rappel (`?linked=google`) ou de l'erreur (`?error=`). */
  notice?: { variant: 'success' | 'danger'; key: string } | null
}>()
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const { logout } = useAuth()
const { startLinkFromSession, unlink } = useSocialLink()

const google = computed(() => props.user.identities?.find((i) => i.provider === 'google') ?? null)
const canLink = computed(() => props.user.email_verified && props.user.email !== null)

const busy = ref<'link' | 'unlink' | null>(null)
const confirmOpen = ref(false)
const failure = ref<{ code: string; key: string } | null>(null)
const unlinked = ref(false)

async function onLink() {
  busy.value = 'link'
  failure.value = null
  unlinked.value = false
  try {
    await startLinkFromSession('/account/security')
    // Navigation en cours : le bouton reste en chargement.
  } catch (e) {
    failure.value = { code: e instanceof AuthError ? e.code : '', key: authErrorKey(e) }
    busy.value = null
  }
}

async function onUnlink() {
  busy.value = 'unlink'
  failure.value = null
  try {
    await unlink('google')
    confirmOpen.value = false
    unlinked.value = true
    emit('changed')
  } catch (e) {
    confirmOpen.value = false
    failure.value = { code: e instanceof AuthError ? e.code : '', key: authErrorKey(e) }
  } finally {
    busy.value = null
  }
}

// Message selon l'erreur : explication + la prochaine action (« Toujours dire quoi faire ensuite »).
const failureAction = computed(() => {
  if (failure.value?.code === 'AUTH_REAUTH_REQUIRED') {
    return {
      label: t('cp.auth.link.reconnect'),
      onClick: () => logout('/auth/login?next=/account/security'),
    }
  }
  if (failure.value?.code === 'AUTH_LAST_SIGN_IN_METHOD') {
    return {
      label: t('cp.account.security.methods.setPassword'),
      onClick: () => navigateTo('/auth/forgot-password'),
    }
  }
  return undefined
})
const failureTitle = computed(() => {
  if (failure.value?.code === 'AUTH_REAUTH_REQUIRED') return t('cp.account.security.reauth')
  if (failure.value?.code === 'AUTH_LAST_SIGN_IN_METHOD') return t('cp.account.security.lastMethod')
  return failure.value ? t(failure.value.key) : ''
})
</script>

<template>
  <section class="flex flex-col gap-4" :aria-labelledby="'cp-methods-title'" data-testid="sign-in-methods">
    <header class="flex flex-col gap-1">
      <h2 id="cp-methods-title" class="text-heading-3 text-cp-ink">{{ t('cp.account.security.methods.title') }}</h2>
      <p class="text-body text-cp-ink-muted">{{ t('cp.account.security.methods.description') }}</p>
    </header>

    <CpAlert v-if="notice" :variant="notice.variant" :title="t(notice.key)" data-testid="security-notice" />
    <CpAlert
      v-if="unlinked"
      variant="success"
      :title="t('cp.account.security.methods.unlinkedSuccess')"
      data-testid="security-unlinked"
    />
    <CpAlert
      v-if="failure"
      variant="danger"
      :title="failureTitle"
      :action="failureAction"
      data-testid="security-failure"
    />

    <ul class="flex flex-col divide-y divide-cp-line">
      <li class="flex min-h-14 flex-wrap items-center gap-3 py-3" data-testid="method-password">
        <UIcon name="i-lucide-key-round" class="size-5 shrink-0 text-cp-ink-muted" aria-hidden="true" />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-label text-cp-ink">{{ t('cp.account.security.methods.password') }}</span>
          <span class="flex items-center gap-1 text-body-sm" :class="user.has_password ? 'text-cp-success' : 'text-cp-ink-muted'">
            <UIcon :name="user.has_password ? 'i-lucide-circle-check' : 'i-lucide-circle-minus'" class="size-4" aria-hidden="true" />
            {{ user.has_password ? t('cp.account.security.methods.passwordSet') : t('cp.account.security.methods.passwordUnset') }}
          </span>
        </div>
        <UButton
          v-if="!user.has_password"
          to="/auth/forgot-password"
          color="neutral"
          variant="outline"
          size="lg"
          class="min-h-11"
          :label="t('cp.account.security.methods.setPassword')"
        />
      </li>

      <li class="flex min-h-14 flex-wrap items-center gap-3 py-3" data-testid="method-phone">
        <UIcon name="i-lucide-smartphone" class="size-5 shrink-0 text-cp-ink-muted" aria-hidden="true" />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-label text-cp-ink">{{ t('cp.account.security.methods.phone') }}</span>
          <span class="text-body-sm text-cp-ink-muted">
            {{ user.phone && user.phone_verified ? user.phone : t('cp.account.security.methods.phoneNone') }}
          </span>
        </div>
      </li>

      <li class="flex min-h-14 flex-wrap items-center gap-3 py-3" data-testid="method-google">
        <img src="/brands/google-g.svg" alt="" width="20" height="20" class="size-5 shrink-0" />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-label text-cp-ink">{{ t('cp.account.security.methods.google') }}</span>
          <span v-if="google" class="flex items-center gap-1 break-all text-body-sm text-cp-success">
            <UIcon name="i-lucide-circle-check" class="size-4 shrink-0" aria-hidden="true" />
            {{ t('cp.account.security.methods.linked', { email: google.email ?? '' }) }}
          </span>
          <span v-else class="text-body-sm text-cp-ink-muted">{{ t('cp.account.security.methods.notLinked') }}</span>
        </div>
        <UButton
          v-if="google"
          color="neutral"
          variant="outline"
          size="lg"
          class="min-h-11"
          icon="i-lucide-unlink"
          :label="t('cp.account.security.methods.unlink')"
          :disabled="busy !== null"
          data-testid="unlink-google"
          @click="confirmOpen = true"
        />
        <UButton
          v-else-if="canLink"
          size="lg"
          class="min-h-11"
          icon="i-lucide-link-2"
          :label="t('cp.account.security.methods.link')"
          :loading="busy === 'link'"
          :disabled="busy !== null"
          data-testid="link-google"
          @click="onLink"
        />
        <p v-else class="flex w-full items-center gap-2 text-body-sm text-cp-ink-muted" data-testid="verify-email-first">
          <UIcon name="i-lucide-info" class="size-4 shrink-0" aria-hidden="true" />
          {{ t('cp.account.security.methods.verifyEmailFirst') }}
        </p>
      </li>
    </ul>

    <CpConfirmDialog
      :open="confirmOpen"
      variant="warning"
      :title="t('cp.account.security.methods.unlinkTitle')"
      :description="t('cp.account.security.methods.unlinkConfirm')"
      :confirm-label="t('cp.account.security.methods.unlink')"
      :loading="busy === 'unlink'"
      @confirm="onUnlink"
      @cancel="confirmOpen = false"
    />
  </section>
</template>
