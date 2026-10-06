<script setup lang="ts">
// Gabarit d'entrée (connexion / inscription) : panneau illustré à gauche (lg+), formulaire à droite.
// Illustration en formes de marque sans libellé, purement décorative (D36/D38).
defineProps<{
  tagline: string
  subtitle: string
}>()

const { t, locale, setLocale } = useI18n()

const languages = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
] as const
</script>

<template>
  <div class="grid min-h-dvh grid-cols-1 bg-cp-canvas text-cp-ink lg:grid-cols-2" data-cp-layout-login>
    <aside class="hidden flex-col justify-between gap-8 p-10 lg:flex" data-cp-login-panel>
      <div class="flex items-center gap-3">
        <span class="flex size-10 items-center justify-center rounded-md bg-cp-brand-violet text-cp-on-primary">
          <UIcon name="i-lucide-workflow" class="size-6" aria-hidden="true" />
        </span>
        <span class="font-display text-heading-3 text-cp-ink">project-cp</span>
      </div>

      <div class="relative mx-auto h-80 w-full max-w-md" aria-hidden="true" data-cp-login-hero>
        <div class="absolute left-0 top-0 h-56 w-40 rounded-xl bg-cp-brand-violet" />
        <div class="absolute left-48 top-12 size-28 rounded-xl bg-cp-accent" />
        <div class="absolute left-28 top-32 h-8 w-14 rounded-md bg-cp-amber" />
        <div class="absolute left-32 top-48 size-36 rounded-xl bg-cp-primary-soft" />
        <div class="absolute left-44 top-60 size-6 rounded-full bg-cp-primary" />
        <div class="absolute left-8 top-60 size-4 rounded-full border-2 border-cp-accent" />
        <div class="absolute left-24 top-72 size-6 rounded-full border-2 border-cp-primary" />
        <div class="absolute left-72 top-64 size-6 rounded-full border-2 border-cp-primary" />
        <div class="absolute left-48 top-20 h-40 border-l-2 border-dotted border-cp-line-strong" />
        <div class="absolute left-44 top-64 w-28 border-t-2 border-dotted border-cp-line-strong" />
      </div>

      <div class="flex max-w-lg flex-col gap-3">
        <h2 class="font-display text-heading-1 text-cp-ink">{{ tagline }}</h2>
        <p class="text-body-lg text-cp-ink-muted">{{ subtitle }}</p>
      </div>
    </aside>

    <main class="flex flex-col p-4 md:p-6 lg:p-10">
      <header class="flex items-center justify-between">
        <div class="flex items-center gap-3 lg:invisible">
          <span class="flex size-10 items-center justify-center rounded-md bg-cp-brand-violet text-cp-on-primary">
            <UIcon name="i-lucide-workflow" class="size-6" aria-hidden="true" />
          </span>
          <span class="font-display text-heading-3 text-cp-ink">project-cp</span>
        </div>
        <div
          role="group"
          :aria-label="t('cp.auth.language')"
          class="inline-flex rounded-lg border border-cp-line bg-cp-surface-sunken p-1"
        >
          <button
            v-for="lang in languages"
            :key="lang.code"
            type="button"
            class="min-h-11 rounded-md px-3 text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cp-primary lg:min-h-9"
            :class="locale === lang.code ? 'bg-cp-surface text-cp-ink shadow-sm' : 'text-cp-ink-muted'"
            :aria-pressed="locale === lang.code"
            :data-cp-lang="lang.code"
            @click="setLocale(lang.code)"
          >
            {{ lang.label }}
          </button>
        </div>
      </header>

      <div class="mx-auto flex w-full max-w-120 flex-1 flex-col justify-center gap-6 py-8">
        <slot />
      </div>
    </main>
  </div>
</template>
