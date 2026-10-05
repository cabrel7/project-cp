<!-- shadcn-vue — Stepper (composant maison, pas de primitif shadcn officiel stable) -->
<template>
  <nav aria-label="Progression" class="flex items-center gap-2">
    <template v-for="(step, i) in steps" :key="i">
      <div
        class="flex items-center gap-2 cursor-pointer"
        :class="{ 'cursor-default': i > currentStep }"
        @click="i < currentStep && emit('goto', i)"
      >
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0"
          :class="dotClass(i)"
        >
          <span v-if="i < currentStep">✓</span>
          <span v-else>{{ i + 1 }}</span>
        </div>
        <span class="text-sm font-medium" :class="i > currentStep ? 'text-[--ink-muted]' : 'text-[--ink]'">
          {{ step.title }}
        </span>
      </div>
      <div
        v-if="i < steps.length - 1"
        class="w-8 h-0.5 shrink-0"
        :class="i < currentStep ? 'bg-[--success]' : 'bg-[--line]'"
      />
    </template>
  </nav>
  <!-- Mobile -->
  <p class="sm:hidden text-sm text-[--ink-muted] mt-2">
    Étape {{ currentStep + 1 }} sur {{ steps.length }} — {{ steps[currentStep]?.title }}
  </p>
</template>

<script setup lang="ts">
const props = defineProps<{
  steps: { title: string }[]
  currentStep: number
}>()
const emit = defineEmits<{ goto: [index: number] }>()

function dotClass(i: number) {
  if (i < props.currentStep) return 'bg-[--success] text-white'
  if (i === props.currentStep) return 'bg-[--primary] text-[--on-primary]'
  return 'bg-[--surface-sunken] text-[--ink-muted] border border-[--line]'
}
</script>

<!--
  + : zéro dépendance — composant léger, 100 % contrôlé
  + : format mobile « Étape 2 sur 4 — Nom » implémenté directement
  + : navigation sur étapes passées via emit
  - : ~45 lignes à écrire et maintenir (a11y, responsive, états)
  - : pas de gestion de formulaire par étape (à construire)
  - : tests et a11y (aria-current, rôle) à écrire manuellement
-->
