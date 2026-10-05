<script setup lang="ts">
// Gabarit G5 — Réglages (organisation, workspace, profil, facturation). Zone dangereuse en dernier.
import CpPageHeader from './PageHeader.vue'

export interface CpSettingsSection {
  value: string
  label: string
  icon?: string
  danger?: boolean
}

defineProps<{
  title: string
  description?: string
  sections: CpSettingsSection[]
}>()

const activeSection = defineModel<string>('section', { required: true })

const emit = defineEmits<{
  'navigate-section': [value: string]
}>()

const { t } = useI18n()

function select(value: string): void {
  activeSection.value = value
  emit('navigate-section', value)
}
</script>

<template>
  <div class="mx-auto flex max-w-content-max flex-col gap-6" data-cp-layout-settings>
    <CpPageHeader :title="title" :description="description" />
    <div class="flex flex-col gap-6 lg:flex-row">
      <nav class="w-full lg:w-56 lg:shrink-0" :aria-label="t('cp.layout.settingsNav')">
        <ul class="flex flex-col gap-1">
          <li v-for="section in sections" :key="section.value">
            <button
              type="button"
              class="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-label"
              :class="section.value === activeSection ? 'bg-cp-primary-soft text-cp-primary' : 'text-cp-ink hover:bg-cp-surface'"
              :aria-current="section.value === activeSection ? 'true' : undefined"
              @click="select(section.value)"
            >
              <UIcon v-if="section.icon" :name="section.icon" class="size-5" aria-hidden="true" />
              <span>{{ section.label }}</span>
            </button>
          </li>
        </ul>
      </nav>
      <div class="flex min-w-0 flex-1 flex-col gap-8" data-cp-settings-content>
        <div v-for="section in sections" v-show="section.value === activeSection" :key="section.value">
          <div
            class="rounded-lg border bg-cp-surface p-6"
            :class="section.danger ? 'border-cp-danger' : 'border-cp-line'"
            :data-section="section.value"
            :data-danger="section.danger || undefined"
          >
            <slot :name="`section-${section.value}`">
              <slot v-if="section.value === activeSection" />
            </slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
