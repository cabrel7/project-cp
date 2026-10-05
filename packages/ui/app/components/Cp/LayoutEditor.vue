<script setup lang="ts">
// Gabarit G7 — Éditeur visuel (cartographie MCP, enchaînement d'agent) + vue liste équivalente.
defineProps<{
  title?: string
  listView?: boolean
}>()

const emit = defineEmits<{
  'toggle-view': []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex h-full flex-col" data-cp-layout-editor>
    <header class="flex items-center gap-3 border-b border-cp-line bg-cp-surface px-4 py-2">
      <h2 v-if="title" class="flex-1 truncate text-heading-3 text-cp-ink">{{ title }}</h2>
      <UButton
        variant="ghost"
        :icon="listView ? 'i-lucide-layout-grid' : 'i-lucide-list'"
        :aria-label="listView ? t('cp.layout.canvasView') : t('cp.layout.listView')"
        @click="emit('toggle-view')"
      />
      <slot name="toolbar" />
    </header>
    <div v-if="listView" class="mx-auto w-full max-w-content-max flex-1 overflow-y-auto p-4 md:p-6" data-cp-editor-list>
      <slot name="list" />
    </div>
    <div v-else class="flex flex-1 overflow-hidden">
      <aside
        class="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-cp-line bg-cp-surface-sunken p-3 lg:flex"
        data-cp-editor-palette
      >
        <slot name="palette" />
      </aside>
      <section class="relative flex-1 bg-cp-canvas" data-cp-editor-canvas>
        <slot name="canvas" />
      </section>
      <aside
        class="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-cp-line bg-cp-surface p-4 lg:flex"
        data-cp-editor-properties
      >
        <slot name="properties" />
      </aside>
    </div>
  </div>
</template>
