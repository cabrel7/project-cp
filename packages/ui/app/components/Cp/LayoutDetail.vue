<script setup lang="ts">
// G2 — page de détail d'une entité : en-tête, statistiques, onglets, contenu + panneau latéral.
import CpPageHeader, { type CpBreadcrumb } from './PageHeader.vue'
import CpSkeleton from './Skeleton.vue'
import CpTabs, { type CpTabItem } from './Tabs.vue'

const props = defineProps<{
  title: string
  breadcrumbs: CpBreadcrumb[]
  tabs?: CpTabItem[]
  loading?: boolean
}>()

const activeTab = defineModel<string>('tab')
// Sans valeur fournie, le premier onglet est actif.
const currentTab = computed(() => activeTab.value ?? props.tabs?.[0]?.value ?? '')
</script>

<template>
  <div class="mx-auto flex max-w-content-max flex-col gap-6" data-cp-layout-detail>
    <CpPageHeader :title="title" :breadcrumbs="breadcrumbs">
      <template v-if="$slots.status || $slots.actions" #actions>
        <slot name="status" />
        <slot name="actions" />
      </template>
    </CpPageHeader>
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]" data-cp-layout-detail-grid>
      <div class="flex min-w-0 flex-col gap-6">
        <div v-if="$slots.stats" class="flex flex-wrap gap-4">
          <slot name="stats" />
        </div>
        <CpTabs
          v-if="tabs"
          :model-value="currentTab"
          :items="tabs"
          @update:model-value="activeTab = $event"
        />
        <CpSkeleton v-if="loading" shape="card" />
        <slot v-else />
      </div>
      <aside v-if="$slots.aside" class="flex flex-col gap-4">
        <slot name="aside" />
      </aside>
    </div>
  </div>
</template>
