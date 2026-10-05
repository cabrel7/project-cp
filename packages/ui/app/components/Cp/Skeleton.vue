<script setup lang="ts">
// Forme grise qui reprend la mise en page attendue pendant le chargement.
// Pas d'animation si prefers-reduced-motion. À n'utiliser que si l'attente dépasse ~300 ms.
export type CpSkeletonShape = 'line' | 'tile' | 'card'

const SHAPE_CLASS: Record<CpSkeletonShape, string> = {
  line: 'h-4 w-full rounded-md',
  tile: 'h-24 w-full rounded-lg',
  card: 'h-40 w-full rounded-lg',
}

const props = withDefaults(defineProps<{ shape: CpSkeletonShape; count?: number }>(), {
  count: 1,
})

const { t } = useI18n()
const items = computed(() =>
  Array.from({ length: Math.max(0, Math.floor(props.count)) }, (_, i) => i),
)
</script>

<template>
  <div
    class="flex flex-col gap-3"
    role="status"
    aria-busy="true"
    :aria-label="t('cp.skeleton.loading')"
  >
    <USkeleton
      v-for="i in items"
      :key="i"
      data-cp-skeleton
      :data-shape="shape"
      class="bg-cp-surface-sunken motion-reduce:animate-none"
      :class="SHAPE_CLASS[shape]"
    />
  </div>
</template>
