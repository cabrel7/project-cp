<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ensureCpMode, useCpMode } from '../../composables/useCpMode'
import CpModeToggle from './ModeToggle.vue'
import CpSidebarNav from './SidebarNav.vue'

export type { CpNavItem } from './SidebarNav.vue'

export interface CpMobileTab {
  value: string
  icon: string
  label: string
  badge?: number
}

const props = defineProps<{
  navItems: import('./SidebarNav.vue').CpNavItem[]
  currentNav: string
  creditsLabel?: string
  notificationCount?: number
  userName?: string
  environmentLabel?: string
  mobileTabs?: CpMobileTab[]
}>()

const emit = defineEmits<{
  navigate: [value: string]
  search: []
  notifications: []
  profile: []
}>()

const { t } = useI18n()
const { technicalMode } = useCpMode()
ensureCpMode()

const drawerOpen = ref(false)

const DEFAULT_TABS: CpMobileTab[] = [
  { value: 'home', icon: 'i-lucide-house', label: 'cp.shell.tab.home' },
  { value: 'chat', icon: 'i-lucide-message-circle', label: 'cp.shell.tab.chat' },
  { value: 'approvals', icon: 'i-lucide-shield-check', label: 'cp.shell.tab.approvals' },
  { value: 'credits', icon: 'i-lucide-coins', label: 'cp.shell.tab.credits' },
]

const tabs = computed(() => props.mobileTabs ?? DEFAULT_TABS)

function go(value: string): void {
  drawerOpen.value = false
  emit('navigate', value)
}

const sidebar = ref<HTMLElement>()
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

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
    <!-- Skip link -->
    <a
      href="#cp-main"
      class="sr-only focus:not-sr-only focus:fixed focus:z-toast focus:top-2 focus:left-2 focus:rounded-md focus:bg-cp-primary focus:text-cp-on-primary focus:px-4 focus:py-2 focus:text-label"
      data-cp-skip-link
    >
      {{ t('cp.shell.skipLink') }}
    </a>

    <!-- Scrim (toujours rendu sous md, opacity animée) -->
    <div
      class="fixed inset-0 z-drawer bg-cp-scrim transition-opacity duration-200 md:hidden"
      :class="drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'"
      data-cp-scrim
      @click="drawerOpen = false"
    />

    <!-- Sidebar : fixe dès md, tiroir animé en dessous -->
    <aside
      ref="sidebar"
      class="fixed inset-y-0 left-0 z-drawer flex w-sidebar shrink-0 flex-col gap-4 bg-cp-surface-sunken p-4 transition-[transform,visibility] duration-250 ease-out motion-reduce:transition-none md:sticky md:top-0 md:h-screen md:translate-x-0"
      :class="drawerOpen ? 'translate-x-0' : '-translate-x-full max-md:invisible'"
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

      <nav class="flex-1 overflow-y-auto" :aria-label="t('cp.shell.nav')">
        <CpSidebarNav :items="navItems" :current-nav="currentNav" @navigate="go" />
      </nav>

      <div class="mt-auto">
        <CpModeToggle v-if="drawerOpen" class="self-start px-3 pb-2 md:hidden" data-cp-drawer-mode />
        <slot name="sidebar-bottom" />
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col" :inert="drawerOpen || undefined">
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

        <span
          v-if="environmentLabel && technicalMode"
          class="rounded-pill bg-cp-accent-soft px-2.5 py-0.5 text-caption font-semibold text-cp-accent-text"
          data-cp-env-badge
        >
          {{ environmentLabel }}
        </span>

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

      <main id="cp-main" class="flex-1 px-4 py-6 pb-24 md:px-8 md:pb-8" data-cp-content>
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
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        class="relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-caption"
        :class="tab.value === currentNav ? 'text-cp-primary' : 'text-cp-ink-muted'"
        :aria-current="tab.value === currentNav ? 'page' : undefined"
        :data-tab="tab.value"
        @click="go(tab.value)"
      >
        <UIcon :name="tab.icon" class="size-5" aria-hidden="true" />
        {{ t(tab.label) }}
        <span
          v-if="tab.badge"
          class="absolute right-1/4 top-0.5 min-w-4 rounded-pill bg-cp-accent px-1 text-center text-[10px] tabular-nums text-cp-on-accent"
          data-cp-tab-badge
        >
          {{ tab.badge }}
        </span>
      </button>
    </nav>
  </div>
</template>
