<script setup lang="ts">
// G5 minimal — Sécurité du compte (P2.3) : seule la section « Moyens de connexion ». P8.8 y ajoute ses sections.
import { queryErrorKey } from '../../utils/authErrors'

definePageMeta({ layout: false, middleware: 'auth' })

const { t } = useI18n()
const route = useRoute()
const { user, fetchMe } = useAuth()

const status = ref<'loading' | 'ready' | 'error'>('loading')
const showSkeleton = ref(false)
const section = ref('methods')
let skeletonTimer: ReturnType<typeof setTimeout> | undefined

const sections = computed(() => [
  {
    value: 'methods',
    label: t('cp.account.security.methods.title'),
    icon: 'i-lucide-shield-check',
  },
])

// Retour du rappel Google : `?linked=google` (succès) ou `?error=<CODE>` (liste blanche).
const notice = computed(() => {
  if (route.query.linked === 'google') {
    return { variant: 'success' as const, key: 'cp.account.security.methods.linkedSuccess' }
  }
  const key = queryErrorKey(route.query.error, route.query.reason)
  return key ? { variant: 'danger' as const, key } : null
})

async function load(force = true) {
  if (!force && user.value) {
    status.value = 'ready'
    return
  }
  if (!user.value) status.value = 'loading'
  clearTimeout(skeletonTimer)
  showSkeleton.value = false
  skeletonTimer = setTimeout(() => {
    showSkeleton.value = true
  }, 300)
  try {
    const me = await fetchMe()
    if (!me) {
      await navigateTo('/auth/login?next=/account/security')
      return
    }
    status.value = 'ready'
  } catch {
    status.value = 'error'
  } finally {
    clearTimeout(skeletonTimer)
  }
}

onMounted(() => load(false))
onBeforeUnmount(() => clearTimeout(skeletonTimer))
useHead({ title: () => t('cp.account.security.title') })
</script>

<template>
  <main class="min-h-dvh bg-cp-canvas p-4 text-cp-ink md:p-8">
    <CpLayoutSettings
      v-model:section="section"
      :title="t('cp.account.security.title')"
      :description="t('cp.account.security.description')"
      :sections="sections"
    >
      <CpSkeleton v-if="status === 'loading' && showSkeleton" shape="tile" :count="3" />
      <CpAlert
        v-else-if="status === 'error'"
        variant="danger"
        :title="t('cp.account.security.loadError')"
        :action="{ label: t('cp.account.security.retry'), onClick: () => load() }"
        data-testid="security-load-error"
      />
      <AccountSignInMethods v-else-if="status === 'ready' && user" :user="user" :notice="notice" @changed="load()" />
    </CpLayoutSettings>
  </main>
</template>
