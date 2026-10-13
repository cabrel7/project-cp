<script setup lang="ts">
// Bloc « ou » + boutons de connexion sociale, piloté par GET /v1/auth/methods (jamais par un réglage du navigateur).
// P2.3 : seul Google est actif ; clé d'accès et Apple restent masqués tant que le serveur ne les annonce pas (P8.8).
withDefaults(defineProps<{ next?: string; rememberMe?: boolean }>(), {
  next: '/',
  rememberMe: true,
})

const { t } = useI18n()
const { buttons } = useAuthMethods()
</script>

<template>
  <template v-if="buttons.separator">
    <USeparator :label="t('cp.auth.login.or')" />
    <div class="flex flex-col gap-3" data-testid="auth-social">
      <UButton
        v-if="buttons.passkey"
        color="neutral"
        variant="outline"
        size="lg"
        block
        disabled
        icon="i-lucide-key-round"
        :label="t('cp.auth.login.passkey')"
        :title="t('cp.auth.comingSoon')"
        data-testid="auth-passkey"
      />
      <AuthGoogleButton v-if="buttons.google" :next="next" :remember-me="rememberMe" />
      <UButton
        v-if="buttons.apple"
        color="neutral"
        variant="outline"
        size="lg"
        block
        disabled
        label="Apple"
        :title="t('cp.auth.comingSoon')"
        data-testid="auth-apple"
      />
    </div>
  </template>
</template>
