<template>
  <CpLayoutAuth
    title="Autoriser Assistant facturation"
    description="Cet assistant demande l’accès à votre compte."
    icon="i-lucide-shield-check"
    data-page="gabarit-auth"
  >
    <ul class="flex flex-col gap-3 text-body text-cp-ink">
      <li class="flex items-center gap-3">
        <UIcon name="i-lucide-eye" class="size-5 text-cp-primary" aria-hidden="true" />
        Voir vos factures
      </li>
      <li class="flex items-center gap-3">
        <UIcon name="i-lucide-mail" class="size-5 text-cp-primary" aria-hidden="true" />
        Envoyer des e-mails en votre nom
      </li>
    </ul>
    <template #footer>
      <p class="text-center text-body-sm text-cp-ink-muted">
        <NuxtLink to="/" class="text-cp-primary hover:underline">Lire les conditions d’utilisation</NuxtLink>
      </p>
    </template>
  </CpLayoutAuth>
</template>
