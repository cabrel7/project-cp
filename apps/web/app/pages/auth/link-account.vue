<script setup lang="ts">
// G8 — Lier un compte Google à un compte existant (D67 : jamais de rattachement automatique). L'utilisateur vient de
// se connecter au compte existant après l'étape Google ; il confirme explicitement. « Annuler » ne fait que naviguer :
// la demande expire seule au bout de 10 minutes.
import { AuthError } from '../../composables/useAuth'
import { authErrorKey } from '../../utils/authErrors'

definePageMeta({ layout: false, middleware: 'auth' })

type Phase =
  | 'loading'
  | 'ready'
  | 'cancelled'
  | 'expired'
  | 'reauth'
  | 'notVerified'
  | 'alreadyLinked'
  | 'error'

const { t } = useI18n()
const { resendVerification, logout } = useAuth()
const { linkPending, confirmLink } = useSocialLink()

const phase = ref<Phase>('loading')
const emailMasked = ref('')
const confirming = ref(false)
const actionError = ref<string | null>(null)
const verificationSent = ref(false)
const alreadyLinkedKey = ref('cp.errors.AUTH_IDENTITY_ALREADY_LINKED.default')

// Pas de squelette pour une attente brève (< 300 ms).
const showSkeleton = ref(false)
let skeletonTimer: ReturnType<typeof setTimeout> | undefined

function phaseFor(e: unknown): Phase {
  if (!(e instanceof AuthError)) return 'error'
  if (e.status === 404) return 'expired'
  if (e.code === 'AUTH_REAUTH_REQUIRED') return 'reauth'
  if (e.code === 'AUTH_ACCOUNT_NOT_VERIFIED') return 'notVerified'
  if (e.code === 'AUTH_IDENTITY_ALREADY_LINKED') {
    alreadyLinkedKey.value = authErrorKey(e)
    return 'alreadyLinked'
  }
  return 'error'
}

function goHome() {
  return navigateTo('/')
}

function goLogin() {
  return navigateTo('/auth/login')
}

// « Annuler » : aucun appel (la demande expire seule) ; on confirme à l'utilisateur que rien n'a été lié.
function onCancel() {
  phase.value = 'cancelled'
}

async function toLogin() {
  await navigateTo('/auth/login?link=google')
}

async function load() {
  phase.value = 'loading'
  showSkeleton.value = false
  skeletonTimer = setTimeout(() => {
    showSkeleton.value = true
  }, 300)
  try {
    const pending = await linkPending()
    emailMasked.value = pending.email_masked
    phase.value = 'ready'
  } catch (e) {
    if (e instanceof AuthError && e.status === 401) return toLogin()
    phase.value = phaseFor(e)
  } finally {
    clearTimeout(skeletonTimer)
  }
}

async function onConfirm() {
  confirming.value = true
  actionError.value = null
  try {
    await confirmLink()
    await navigateTo('/')
  } catch (e) {
    if (e instanceof AuthError && e.status === 401) return toLogin()
    phase.value = phaseFor(e)
    if (phase.value === 'error') actionError.value = authErrorKey(e)
  } finally {
    confirming.value = false
  }
}

async function onResend() {
  confirming.value = true
  try {
    await resendVerification()
    verificationSent.value = true
  } catch (e) {
    actionError.value = authErrorKey(e)
  } finally {
    confirming.value = false
  }
}

// Action unique de chaque écran d'information ou d'erreur (le bouton « Annuler » disparaît).
const primary = computed<{ label: string; run: () => unknown }>(() => {
  switch (phase.value) {
    case 'ready':
      return { label: t('cp.auth.link.confirm'), run: onConfirm }
    case 'reauth':
      return { label: t('cp.auth.link.reconnect'), run: () => logout('/auth/login?link=google') }
    case 'notVerified':
      return { label: t('cp.auth.link.resendVerification'), run: onResend }
    case 'error':
      return { label: t('cp.auth.link.retry'), run: load }
    case 'expired':
    case 'alreadyLinked':
      return { label: t('cp.auth.link.backToLogin'), run: goLogin }
    default:
      return { label: t('cp.auth.link.continue'), run: goHome }
  }
})

const message = computed<string | null>(() => {
  switch (phase.value) {
    case 'cancelled':
      return t('cp.auth.link.cancelled')
    case 'expired':
      return t('cp.auth.link.expired')
    case 'reauth':
      return t('cp.errors.AUTH_REAUTH_REQUIRED')
    case 'notVerified':
      return t('cp.errors.AUTH_ACCOUNT_NOT_VERIFIED')
    case 'alreadyLinked':
      return t(alreadyLinkedKey.value)
    case 'error':
      return t(actionError.value ?? 'cp.auth.genericError')
    default:
      return null
  }
})

const variant = computed(() =>
  phase.value === 'alreadyLinked' || phase.value === 'cancelled'
    ? 'info'
    : phase.value === 'error'
      ? 'danger'
      : 'warning',
)

onMounted(load)
onBeforeUnmount(() => clearTimeout(skeletonTimer))
useHead({ title: () => t('cp.auth.link.title') })
</script>

<template>
  <CpLayoutAuth
    :title="t('cp.auth.link.title')"
    :description="phase === 'ready' ? t('cp.auth.link.body', { email: emailMasked }) : undefined"
    icon="i-lucide-link-2"
    :confirm-label="primary.label"
    :cancel-label="t('cp.auth.link.cancel')"
    :confirm-loading="confirming || phase === 'loading'"
    :hide-cancel="phase !== 'ready' && phase !== 'loading'"
    @confirm="phase === 'loading' ? undefined : primary.run()"
    @cancel="onCancel"
  >
    <CpSkeleton v-if="phase === 'loading' && showSkeleton" shape="line" :count="2" />
    <p v-else-if="phase === 'ready'" class="text-center text-body-sm text-cp-ink-muted" data-testid="link-consent">
      {{ t('cp.auth.link.consent') }}
    </p>
    <CpAlert v-if="message" :variant="variant" :title="message" />
    <CpAlert
      v-if="verificationSent"
      variant="success"
      :title="t('cp.auth.link.verificationSent')"
    />
  </CpLayoutAuth>
</template>
