<script setup lang="ts">
// G4 — tableau de bord : chiffres clés, crédits, graphiques, actions en attente.
import CpPageHeader from './PageHeader.vue'
import CpSkeleton from './Skeleton.vue'

defineProps<{
  title: string
  description?: string
  loading?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <div class="mx-auto flex max-w-content-max flex-col gap-6" data-cp-layout-dashboard>
    <CpPageHeader :title="title" :description="description">
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </CpPageHeader>
    <CpSkeleton v-if="loading" shape="tile" :count="4" />
    <template v-else>
      <section v-if="$slots.stats">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <slot name="stats" />
        </div>
      </section>
      <section v-if="$slots.credits">
        <slot name="credits" />
      </section>
      <section v-if="$slots.charts">
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <slot name="charts" />
        </div>
      </section>
      <section v-if="$slots.todo" :aria-label="t('cp.layout.todoSection')">
        <slot name="todo" />
      </section>
    </template>
  </div>
</template>
