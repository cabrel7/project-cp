<script setup lang="ts">
// Cadre des pages connectées (version statique P1.2 ; le branchement au routeur arrive avec P1.3).
// Barre latérale (surface-sunken) : logo, espace de travail, navigation groupée, élément courant en primary-soft.
// Barre du haut : recherche, crédits (amber-soft), notifications, ModeToggle, profil.
// Sous md : la barre latérale devient un tiroir + barre d'onglets en bas (Accueil, Discuter, À valider, Crédits).
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ensureCpMode } from '../../composables/useCpMode'
import CpModeToggle from './ModeToggle.vue'

export interface CpNavItem {
  label: string
  icon: string
  value: string
  badge?: number
  /** Titre de groupe : affiché quand il change d'une entrée à la suivante. */
  group?: string
}

const props = defineProps<{
  navItems: CpNavItem[]
  currentNav: string
  workspaceName: string
  /** Jeton de crédits de la barre du haut (ex. « 12 430 cr »), déjà formaté. */
  creditsLabel?: string
  notificationCount?: number
  userName?: string
}>()

const emit = defineEmits<{
  navigate: [value: string]
  'switch-workspace': []
  search: []
  notifications: []
  profile: []
}>()

const { t } = useI18n()
ensureCpMode()

const drawerOpen = ref(false)

const TABS = [
  { value: 'home', icon: 'i-lucide-house', label: 'cp.shell.tab.home' },
  { value: 'chat', icon: 'i-lucide-message-circle', label: 'cp.shell.tab.chat' },
  { value: 'approvals', icon: 'i-lucide-shield-check', label: 'cp.shell.tab.approvals' },
  { value: 'credits', icon: 'i-lucide-coins', label: 'cp.shell.tab.credits' },
] as const

const entries = computed(() =>
  props.navItems.map((item, index) => ({
    item,
    heading: item.group && item.group !== props.navItems[index - 1]?.group ? item.group : undefined,
  })),
)

function go(value: string): void {
  drawerOpen.value = false
  emit('navigate', value)
}

const sidebar = ref<HTMLElement>()
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Tiroir modal : focus déplacé dedans à l'ouverture, rendu au bouton d'ouverture à la fermeture, Tab piégé.
function onKeydown(event: KeyboardEvent): void {
  if (!drawerOpen.value) return
  if (event.key === 'Escape') {
    drawerOpen.value = false
    return
  }
  if (event.key !== 'Tab' || !sidebar.value) return
  const nodes = [...sidebar.value.querySelectorAll<HTMLElement>(FOCUSABLE)]
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
watch(drawerOpen, (open) => {
  nextTick(() => {
    const target = open
      ? sidebar.value?.querySelector<HTMLElement>('[data-cp-drawer-close]')
      : document.querySelector<HTMLElement>('[data-cp-drawer-open]')
    target?.focus()
  })
})
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

const ICON_BUTTON =
  'relative flex size-11 items-center justify-center rounded-md text-cp-ink-muted hover:bg-cp-surface-sunken hover:text-cp-ink md:size-10'
</script>

<template>
  <div class="flex min-h-screen bg-cp-canvas text-cp-ink" data-cp-app-shell>
    <!-- Barre latérale : fixe dès md, tiroir en dessous -->
    <div
      v-if="drawerOpen"
      class="fixed inset-0 z-drawer bg-cp-scrim md:hidden"
      data-cp-scrim
      @click="drawerOpen = false"
    />
    <aside
      ref="sidebar"
      class="w-sidebar shrink-0 flex-col gap-4 bg-cp-surface-sunken p-4 md:sticky md:top-0 md:flex md:h-screen"
      :class="drawerOpen ? 'fixed inset-y-0 left-0 z-drawer flex' : 'hidden'"
      :role="drawerOpen ? 'dialog' : undefined"
      :aria-modal="drawerOpen ? 'true' : undefined"
      :aria-label="t('cp.shell.nav')"
      data-cp-sidebar
    >
      <div class="flex items-center justify-between gap-2 px-2">
        <slot name="logo">
          <span class="flex items-center gap-2 font-display text-heading-3 text-cp-ink">
            <UIcon name="i-lucide-sparkles" class="size-5 text-cp-brand-violet" aria-hidden="true" />
            {{ t('cp.shell.logo') }}
          </span>
        </slot>
        <button
          v-if="drawerOpen"
          type="button"
          :class="ICON_BUTTON"
          :aria-label="t('cp.shell.closeMenu')"
          data-cp-drawer-close
          @click="drawerOpen = false"
        >
          <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        class="flex min-h-11 items-center justify-between gap-2 rounded-md border border-cp-line bg-cp-surface px-3 text-label text-cp-ink md:min-h-10"
        :aria-label="`${t('cp.shell.switchWorkspace')} : ${workspaceName}`"
        data-cp-workspace
        @click="emit('switch-workspace')"
      >
        <span class="truncate">{{ workspaceName }}</span>
        <UIcon name="i-lucide-chevrons-up-down" class="size-4 shrink-0 text-cp-ink-muted" aria-hidden="true" />
      </button>

      <nav class="flex flex-1 flex-col gap-1 overflow-y-auto" :aria-label="t('cp.shell.nav')">
        <template v-for="entry in entries" :key="entry.item.value">
          <p v-if="entry.heading" class="mt-3 px-3 text-caption text-cp-ink-muted" data-cp-nav-group>
            {{ entry.heading }}
          </p>
          <button
            type="button"
            class="flex min-h-11 items-center gap-3 rounded-md px-3 text-label md:min-h-10"
            :class="
              entry.item.value === currentNav
                ? 'bg-cp-primary-soft text-cp-primary'
                : 'text-cp-ink hover:bg-cp-surface'
            "
            :aria-current="entry.item.value === currentNav ? 'page' : undefined"
            :data-nav="entry.item.value"
            @click="go(entry.item.value)"
          >
            <UIcon :name="entry.item.icon" class="size-5 shrink-0" aria-hidden="true" />
            <span class="flex-1 truncate text-left">{{ entry.item.label }}</span>
            <span
              v-if="entry.item.badge"
              class="rounded-pill bg-cp-primary px-2 text-caption tabular-nums text-cp-on-primary"
              data-cp-nav-badge
            >
              {{ entry.item.badge }}
            </span>
          </button>
        </template>
      </nav>

      <!-- Sous md la barre du haut n'a pas la place : la bascule Simple / Technique vit dans le tiroir. -->
      <CpModeToggle v-if="drawerOpen" class="self-start md:hidden" data-cp-drawer-mode />
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-sticky flex items-center gap-2 border-b border-cp-line bg-cp-surface px-4 py-2 md:px-6"
        data-cp-topbar
      >
        <button
          type="button"
          :class="[ICON_BUTTON, 'md:hidden']"
          :aria-label="t('cp.shell.openMenu')"
          :aria-expanded="drawerOpen"
          data-cp-drawer-open
          @click="drawerOpen = true"
        >
          <UIcon name="i-lucide-menu" class="size-5" aria-hidden="true" />
        </button>
        <button type="button" :class="ICON_BUTTON" :aria-label="t('cp.shell.search')" data-cp-search @click="emit('search')">
          <UIcon name="i-lucide-search" class="size-5" aria-hidden="true" />
        </button>

        <div class="ml-auto flex items-center gap-2">
          <span
            v-if="creditsLabel"
            class="flex items-center gap-1 rounded-pill bg-cp-amber-soft px-3 py-1 text-label tabular-nums text-cp-amber-text"
            data-cp-credits
          >
            <UIcon name="i-lucide-coins" class="size-4" aria-hidden="true" />
            <span class="sr-only">{{ t('cp.shell.credits') }} :</span>
            {{ creditsLabel }}
          </span>
          <slot name="topbar-actions" />
          <button
            type="button"
            :class="ICON_BUTTON"
            :aria-label="t('cp.shell.notifications')"
            data-cp-notifications
            @click="emit('notifications')"
          >
            <UIcon name="i-lucide-bell" class="size-5" aria-hidden="true" />
            <span
              v-if="notificationCount"
              class="absolute right-1 top-1 min-w-4 rounded-pill bg-cp-accent px-1 text-center text-caption tabular-nums text-cp-on-accent"
              data-cp-notification-count
            >
              {{ notificationCount }}
            </span>
          </button>
          <CpModeToggle class="hidden md:inline-flex" />
          <button type="button" :class="ICON_BUTTON" :aria-label="t('cp.shell.profile')" data-cp-profile @click="emit('profile')">
            <span
              v-if="userName"
              class="flex size-8 items-center justify-center rounded-pill bg-cp-primary-soft text-label text-cp-primary"
              aria-hidden="true"
            >
              {{ userName.slice(0, 1).toUpperCase() }}
            </span>
            <UIcon v-else name="i-lucide-circle-user" class="size-6" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main class="flex-1 px-4 py-6 pb-24 md:px-8 md:pb-8" data-cp-content>
        <slot />
      </main>
    </div>

    <!-- Barre d'onglets mobile -->
    <nav
      class="fixed inset-x-0 bottom-0 z-sticky flex border-t border-cp-line bg-cp-surface md:hidden"
      :aria-label="t('cp.shell.tabs')"
      data-cp-tabbar
    >
      <button
        v-for="tab in TABS"
        :key="tab.value"
        type="button"
        class="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-caption"
        :class="tab.value === currentNav ? 'text-cp-primary' : 'text-cp-ink-muted'"
        :aria-current="tab.value === currentNav ? 'page' : undefined"
        :data-tab="tab.value"
        @click="go(tab.value)"
      >
        <UIcon :name="tab.icon" class="size-5" aria-hidden="true" />
        {{ t(tab.label) }}
      </button>
    </nav>
  </div>
</template>
