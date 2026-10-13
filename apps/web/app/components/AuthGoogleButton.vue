<script setup lang="ts">
// Bouton « Continuer avec Google » (connexion ET inscription). Charte « Sign in with Google » : logo « G » officiel
// en couleurs d'origine (fichier de marque public/brands/google-g.svg), libellé exact, pleine largeur.
// Le chargement est montré par le logo remplacé (la prop `loading` rendrait le lien inerte avant la navigation).
// Fond, bordure et texte = tokens du design system (écart consigné : ni Roboto, ni les couleurs exactes de la charte).
import { safeNextPath } from '@cp/shared/safe-next'

const props = withDefaults(defineProps<{ next?: string; rememberMe?: boolean }>(), {
  next: '/',
  rememberMe: true,
})

const { t, locale } = useI18n()
const isOnline = useOnlineStatus()
const redirecting = ref(false)

// Navigation de premier niveau (le rappel de Google est une redirection) vers l'API, via le proxy /v1.
const href = computed(() => {
  const query = new URLSearchParams({
    next: safeNextPath(props.next),
    remember_me: String(props.rememberMe),
    locale: locale.value === 'en' ? 'en' : 'fr',
  })
  return `/v1/auth/oauth/google/start?${query.toString()}`
})

// Garde de délai : si la navigation n'aboutit pas (réseau, Google lent), le bouton redevient utilisable.
const REDIRECT_TIMEOUT_MS = 10_000
let resetTimer: ReturnType<typeof setTimeout> | undefined

function reset() {
  clearTimeout(resetTimer)
  redirecting.value = false
}

function onClick(event: MouseEvent) {
  if (!isOnline.value || redirecting.value) {
    event.preventDefault()
    return
  }
  redirecting.value = true
  resetTimer = setTimeout(reset, REDIRECT_TIMEOUT_MS)
}

// Retour arrière depuis Google : la page revient du cache (bfcache) avec l'état « redirection » figé.
function onPageShow(event: PageTransitionEvent) {
  if (event.persisted) reset()
}
onMounted(() => window.addEventListener('pageshow', onPageShow))
onBeforeUnmount(() => {
  window.removeEventListener('pageshow', onPageShow)
  clearTimeout(resetTimer)
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <UButton
      :to="isOnline ? href : undefined"
      external
      color="neutral"
      variant="outline"
      size="lg"
      block
      :disabled="!isOnline"
      :title="isOnline ? undefined : t('cp.auth.social.offline')"
      :aria-describedby="isOnline ? undefined : 'cp-google-offline'"
      :aria-busy="redirecting"
      class="min-h-11 bg-cp-surface text-cp-ink ring-cp-line hover:bg-cp-surface-sunken"
      data-testid="auth-google"
      @click="onClick"
    >
      <template #leading>
        <UIcon
          v-if="redirecting"
          name="i-lucide-loader-circle"
          class="size-5 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <img v-else src="/brands/google-g.svg" alt="" width="20" height="20" class="size-5 shrink-0" />
      </template>
      {{ t('cp.auth.social.continueWithGoogle') }}
    </UButton>
    <p v-if="redirecting" class="sr-only" role="status">{{ t('cp.auth.social.redirecting') }}</p>
    <p
      v-if="!isOnline"
      id="cp-google-offline"
      class="flex items-center gap-2 text-body-sm text-cp-ink-muted"
      role="status"
    >
      <UIcon name="i-lucide-wifi-off" class="size-4 shrink-0" aria-hidden="true" />
      {{ t('cp.auth.social.offline') }}
    </p>
  </div>
</template>
