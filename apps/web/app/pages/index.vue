<script setup lang="ts">
// Page de démonstration du thème (lot P1.1). Remplacée par l'accueil réel (G4) plus tard.
// Classes écrites en toutes lettres : Tailwind ne détecte pas les classes construites dynamiquement.
interface Swatch {
  name: string
  swatch: string
  text: string
}

const colorMode = useColorMode()
const isDark = computed({
  get: () => colorMode.value === 'dark',
  set: (value: boolean) => {
    colorMode.preference = value ? 'dark' : 'light'
  },
})

const swatches: Swatch[] = [
  { name: 'canvas', swatch: 'bg-cp-canvas', text: 'text-cp-ink' },
  { name: 'surface', swatch: 'bg-cp-surface', text: 'text-cp-ink' },
  { name: 'surface-sunken', swatch: 'bg-cp-surface-sunken', text: 'text-cp-ink' },
  { name: 'surface-raised', swatch: 'bg-cp-surface-raised', text: 'text-cp-ink' },
  { name: 'line', swatch: 'bg-cp-line', text: 'text-cp-ink' },
  { name: 'line-strong', swatch: 'bg-cp-line-strong', text: 'text-cp-canvas' },
  { name: 'ink', swatch: 'bg-cp-ink', text: 'text-cp-canvas' },
  { name: 'ink-muted', swatch: 'bg-cp-ink-muted', text: 'text-cp-canvas' },
  { name: 'ink-disabled', swatch: 'bg-cp-ink-disabled', text: 'text-cp-ink' },
  { name: 'brand-violet', swatch: 'bg-cp-brand-violet', text: 'text-cp-ink' },
  { name: 'primary', swatch: 'bg-cp-primary', text: 'text-cp-on-primary' },
  { name: 'primary-hover', swatch: 'bg-cp-primary-hover', text: 'text-cp-on-primary' },
  { name: 'primary-soft', swatch: 'bg-cp-primary-soft', text: 'text-cp-primary' },
  { name: 'accent', swatch: 'bg-cp-accent', text: 'text-cp-on-accent' },
  { name: 'accent-soft', swatch: 'bg-cp-accent-soft', text: 'text-cp-accent-text' },
  { name: 'amber', swatch: 'bg-cp-amber', text: 'text-cp-on-accent' },
  { name: 'amber-soft', swatch: 'bg-cp-amber-soft', text: 'text-cp-amber-text' },
  { name: 'success', swatch: 'bg-cp-success', text: 'text-cp-canvas' },
  { name: 'success-soft', swatch: 'bg-cp-success-soft', text: 'text-cp-success' },
  { name: 'warning', swatch: 'bg-cp-warning', text: 'text-cp-canvas' },
  { name: 'warning-soft', swatch: 'bg-cp-warning-soft', text: 'text-cp-warning' },
  { name: 'danger', swatch: 'bg-cp-danger', text: 'text-cp-on-danger' },
  { name: 'danger-soft', swatch: 'bg-cp-danger-soft', text: 'text-cp-danger' },
  { name: 'info', swatch: 'bg-cp-info', text: 'text-cp-canvas' },
  { name: 'info-soft', swatch: 'bg-cp-info-soft', text: 'text-cp-info' },
  { name: 'chart-1', swatch: 'bg-cp-chart-1', text: 'text-cp-on-primary' },
  { name: 'chart-2', swatch: 'bg-cp-chart-2', text: 'text-cp-on-primary' },
  { name: 'chart-3', swatch: 'bg-cp-chart-3', text: 'text-cp-on-primary' },
  { name: 'chart-4', swatch: 'bg-cp-chart-4', text: 'text-cp-on-primary' },
  { name: 'chart-5', swatch: 'bg-cp-chart-5', text: 'text-cp-on-primary' },
  { name: 'chart-6', swatch: 'bg-cp-chart-6', text: 'text-cp-ink' },
]

interface TypeSample {
  name: string
  classes: string
  sample: string
}

const typeSamples: TypeSample[] = [
  {
    name: 'display',
    classes: 'font-display text-display',
    sample: 'Connectez votre boutique à l’IA',
  },
  { name: 'heading-1', classes: 'font-display text-heading-1', sample: 'Agents' },
  { name: 'heading-2', classes: 'font-display text-heading-2', sample: 'Relances clients' },
  {
    name: 'heading-3',
    classes: 'font-display text-heading-3',
    sample: 'Étape 2 — Choisir les actions',
  },
  {
    name: 'body-lg',
    classes: 'font-sans text-body-lg',
    sample: 'Votre agent a envoyé 3 relances ce matin.',
  },
  {
    name: 'body',
    classes: 'font-sans text-body',
    sample: 'Choisissez ce que l’IA a le droit de faire.',
  },
  { name: 'body-sm', classes: 'font-sans text-body-sm', sample: 'Dernière exécution il y a 2 min' },
  { name: 'label', classes: 'font-sans text-label', sample: 'Nom de l’agent' },
  { name: 'caption', classes: 'font-sans text-caption', sample: 'ACTIF' },
  { name: 'kpi', classes: 'font-sans text-kpi tabular-nums', sample: '12 430 cr' },
  { name: 'code', classes: 'font-mono text-code', sample: "ai.run('invoice.extract')" },
  { name: 'code-sm', classes: 'font-mono text-code-sm', sample: 'run_01a0eb9c…' },
]

const icons: string[] = [
  'i-lucide-plug',
  'i-lucide-server',
  'i-lucide-wrench',
  'i-lucide-bot',
  'i-lucide-sparkles',
  'i-lucide-play',
  'i-lucide-shield-check',
  'i-lucide-coins',
  'i-lucide-gauge',
  'i-lucide-key-round',
  'i-lucide-scroll-text',
  'i-lucide-moon',
]
</script>

<template>
  <main class="min-h-screen bg-cp-canvas text-cp-ink">
    <div class="mx-auto flex max-w-(--width-content-max) flex-col gap-8 px-4 py-10 md:px-6">
      <header class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="font-display text-heading-1 text-cp-ink">project-cp — Thème</h1>
          <p class="text-body text-cp-ink-muted">Démonstration des jetons du design system (clair et sombre).</p>
        </div>
        <label class="flex min-h-11 items-center gap-3 text-label text-cp-ink">
          <UIcon name="i-lucide-sun" class="size-5" />
          <USwitch v-model="isDark" aria-label="Mode sombre" />
          <UIcon name="i-lucide-moon" class="size-5" />
          <span>Mode sombre</span>
        </label>
      </header>

      <section class="flex flex-col gap-4">
        <h2 class="font-display text-heading-2">Palette</h2>
        <div class="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <div
            v-for="item in swatches"
            :key="item.name"
            class="flex h-20 flex-col justify-end rounded-lg border border-cp-line p-2 shadow-sm"
            :class="[item.swatch, item.text]"
          >
            <span class="font-mono text-code-sm">{{ item.name }}</span>
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-4">
        <h2 class="font-display text-heading-2">Boutons</h2>
        <div class="flex flex-col gap-3 rounded-lg border border-cp-line bg-cp-surface p-4 shadow-sm md:p-6">
          <div v-for="variant in (['solid', 'outline', 'ghost'] as const)" :key="variant" class="flex flex-wrap items-center gap-3">
            <span class="w-20 font-mono text-code-sm text-cp-ink-muted">{{ variant }}</span>
            <UButton color="primary" :variant="variant" label="Primary" icon="i-lucide-plus" />
            <UButton color="secondary" :variant="variant" label="Secondary" />
            <UButton color="error" :variant="variant" label="Error" icon="i-lucide-trash-2" />
            <UButton color="primary" :variant="variant" label="Désactivé" disabled />
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-4">
        <h2 class="font-display text-heading-2">Typographie</h2>
        <div class="flex flex-col divide-y divide-cp-line rounded-lg border border-cp-line bg-cp-surface shadow-sm">
          <div v-for="item in typeSamples" :key="item.name" class="flex flex-col gap-1 p-4 md:flex-row md:items-baseline md:gap-6">
            <span class="w-24 shrink-0 font-mono text-code-sm text-cp-ink-muted">{{ item.name }}</span>
            <span :class="item.classes">{{ item.sample }}</span>
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-4">
        <h2 class="font-display text-heading-2">Icônes Lucide</h2>
        <div class="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <div
            v-for="icon in icons"
            :key="icon"
            class="flex items-center gap-2 rounded-md border border-cp-line bg-cp-surface p-3 text-cp-primary"
          >
            <UIcon :name="icon" class="size-5" />
            <span class="font-mono text-code-sm text-cp-ink-muted">{{ icon.replace('i-lucide-', '') }}</span>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
