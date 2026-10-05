<script setup lang="ts">
import { computed } from 'vue'

export interface CpNavItem {
  /** Identifiant unique (ex : 'home', 'mcp-servers'). */
  value: string
  /** Classe d'icône Lucide (ex : 'i-lucide-house'). */
  icon: string
  /** Libellé déjà traduit. */
  label: string
  /** Compteur affiché en pastille. */
  badge?: number
  /** En-tête de section affiché quand le groupe change. */
  group?: string
  /** Lien externe : ouvert dans un nouvel onglet. */
  external?: boolean
}

const props = withDefaults(
  defineProps<{
    items: CpNavItem[]
    currentNav: string
    /** 'md' = 40px desktop / 48px mobile (client), 'sm' = 32px (admin). */
    size?: 'md' | 'sm'
  }>(),
  { size: 'md' },
)

const emit = defineEmits<{
  navigate: [value: string]
}>()

const entries = computed(() =>
  props.items.map((item, index) => ({
    item,
    heading: item.group && item.group !== props.items[index - 1]?.group ? item.group : undefined,
  })),
)

const itemClass = computed(() =>
  props.size === 'sm' ? 'min-h-8 text-body-sm' : 'min-h-11 text-label md:min-h-10',
)
const iconClass = computed(() => (props.size === 'sm' ? 'size-4' : 'size-5'))

function stateClass(value: string): string {
  return value === props.currentNav
    ? 'bg-cp-primary-soft text-cp-primary'
    : 'text-cp-ink hover:bg-cp-surface'
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <template v-for="entry in entries" :key="entry.item.value">
      <p v-if="entry.heading" class="mt-3 px-3 text-caption text-cp-ink-muted" data-cp-nav-group>
        {{ entry.heading }}
      </p>
      <component
        :is="entry.item.external ? 'a' : 'button'"
        :type="entry.item.external ? undefined : 'button'"
        :href="entry.item.external ? entry.item.value : undefined"
        :target="entry.item.external ? '_blank' : undefined"
        :rel="entry.item.external ? 'noopener' : undefined"
        class="flex items-center gap-3 rounded-md px-3"
        :class="[itemClass, stateClass(entry.item.value)]"
        :aria-current="entry.item.value === currentNav ? 'page' : undefined"
        :data-nav="entry.item.value"
        data-cp-nav-item
        :data-cp-nav-external="entry.item.external ? '' : undefined"
        @click="!entry.item.external && emit('navigate', entry.item.value)"
      >
        <UIcon :name="entry.item.icon" class="shrink-0" :class="iconClass" aria-hidden="true" />
        <span class="flex-1 truncate text-left">{{ entry.item.label }}</span>
        <span
          v-if="entry.item.badge"
          class="rounded-pill bg-cp-primary px-2 text-caption tabular-nums text-cp-on-primary"
          data-cp-nav-badge
        >
          {{ entry.item.badge }}
        </span>
        <UIcon
          v-if="entry.item.external"
          name="i-lucide-external-link"
          class="size-4 shrink-0 text-cp-ink-muted"
          aria-hidden="true"
        />
      </component>
    </template>
  </div>
</template>
