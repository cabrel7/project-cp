<script setup lang="ts">
// G1 — page de liste (assistants, serveurs MCP, connecteurs, clés, runs…). Présentation pure.
import CpFilterBar from './FilterBar.vue'
import CpPageHeader, { type CpBreadcrumb } from './PageHeader.vue'
import CpSkeleton from './Skeleton.vue'

defineProps<{
  title: string
  description?: string
  breadcrumbs?: CpBreadcrumb[]
  searchPlaceholder?: string
  activeFilterCount?: number
  loading?: boolean
}>()

const searchModel = defineModel<string>('search', { default: '' })
const emit = defineEmits<{ 'clear-filters': [] }>()
</script>

<template>
  <div class="mx-auto flex max-w-content-max flex-col gap-6" data-cp-layout-list>
    <CpPageHeader :title="title" :description="description" :breadcrumbs="breadcrumbs">
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </CpPageHeader>
    <CpFilterBar
      v-model="searchModel"
      :search-placeholder="searchPlaceholder"
      :active-count="activeFilterCount"
      @clear="emit('clear-filters')"
    >
      <slot name="filters" />
    </CpFilterBar>
    <CpSkeleton v-if="loading" shape="line" :count="6" />
    <div v-else>
      <div :class="$slots['mobile-cards'] ? 'hidden md:block' : ''" data-cp-layout-list-main>
        <slot />
      </div>
      <div v-if="$slots['mobile-cards']" class="md:hidden" data-cp-layout-list-mobile>
        <slot name="mobile-cards" />
      </div>
    </div>
    <slot name="empty" />
  </div>
</template>
