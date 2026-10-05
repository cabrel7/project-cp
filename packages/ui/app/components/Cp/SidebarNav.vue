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
  /** Lien externe : ouvert dans un nouvel onglet (nécessite `href`). */
  external?: boolean
  /** URL cible d'un lien externe (http/https uniquement). */
  href?: string
  /** Route interne (NuxtLink). Absente : le parent navigue via l'événement `navigate`. */
  to?: string
  /** Fonction non incluse dans le plan : désactivée visuellement, ne navigue pas. */
  locked?: boolean
}

const SAFE_URL = /^https?:\/\//i
function safeHref(href?: string): string | undefined {
  return href && SAFE_URL.test(href) ? href : undefined
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

const { t } = useI18n()

const visibleItems = computed(() =>
  props.items.filter((item) => !item.external || safeHref(item.href) !== undefined),
)
const entries = computed(() =>
  visibleItems.value.map((item, index) => ({
    item,
    heading:
      item.group && item.group !== visibleItems.value[index - 1]?.group ? item.group : undefined,
  })),
)

const itemClass = computed(() =>
  props.size === 'sm' ? 'min-h-8 text-body-sm' : 'min-h-11 text-label md:min-h-9',
)
const iconClass = computed(() => (props.size === 'sm' ? 'size-4' : 'size-5'))

function stateClass(item: CpNavItem): string {
  if (item.locked) return 'cursor-not-allowed text-cp-ink-disabled'
  return item.value === props.currentNav
    ? 'bg-cp-primary-soft text-cp-primary'
    : 'text-cp-ink hover:bg-cp-surface'
}

function onClick(event: MouseEvent, item: CpNavItem) {
  if (item.locked) {
    event.preventDefault()
    return
  }
  if (item.external) return
  // Sans route cible, le parent gère la navigation (événement `navigate`).
  if (!item.to) event.preventDefault()
  emit('navigate', item.value)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <template v-for="entry in entries" :key="entry.item.value">
      <p v-if="entry.heading" class="mt-3 px-3 text-caption text-cp-ink-muted" data-cp-nav-group>
        {{ entry.heading }}
      </p>
      <NuxtLink
        :to="entry.item.external ? safeHref(entry.item.href) : (entry.item.to ?? '#')"
        :external="entry.item.external || undefined"
        :target="entry.item.external ? '_blank' : undefined"
        :rel="entry.item.external ? 'noopener noreferrer' : undefined"
        class="flex items-center gap-3 rounded-md px-3"
        :class="[itemClass, stateClass(entry.item)]"
        :aria-current="entry.item.value === currentNav && !entry.item.locked ? 'page' : undefined"
        :aria-disabled="entry.item.locked ? 'true' : undefined"
        :tabindex="entry.item.locked ? -1 : undefined"
        :data-nav="entry.item.value"
        data-cp-nav-item
        :data-cp-nav-external="entry.item.external ? '' : undefined"
        :data-cp-nav-locked="entry.item.locked ? '' : undefined"
        @click="onClick($event, entry.item)"
      >
        <UIcon :name="entry.item.icon" class="shrink-0" :class="iconClass" aria-hidden="true" />
        <span class="flex-1 truncate text-left">{{ entry.item.label }}</span>
        <span
          v-if="entry.item.badge && !entry.item.locked"
          class="rounded-pill bg-cp-primary px-2 text-caption tabular-nums text-cp-on-primary"
          data-cp-nav-badge
        >
          {{ entry.item.badge }}
        </span>
        <template v-if="entry.item.locked">
          <UIcon name="i-lucide-lock" class="size-4 shrink-0" aria-hidden="true" data-cp-nav-lock />
          <span class="sr-only">{{ t('cp.nav.locked') }}</span>
        </template>
        <UIcon
          v-else-if="entry.item.external"
          name="i-lucide-external-link"
          class="size-4 shrink-0 text-cp-ink-muted"
          aria-hidden="true"
        />
      </NuxtLink>
    </template>
  </div>
</template>
