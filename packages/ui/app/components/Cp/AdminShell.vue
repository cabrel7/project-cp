<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CpSidebarNav from './SidebarNav.vue'

const props = defineProps<{
  navItems: import('./SidebarNav.vue').CpNavItem[]
  currentNav: string
  userName: string
  userRole: string
  has2fa?: boolean
  environmentLabel?: string
  sessionTimeRemaining?: string
  emergencyStopActive?: boolean
}>()

const emit = defineEmits<{
  navigate: [value: string]
  search: []
  profile: []
  'emergency-stop': []
}>()

const { t } = useI18n()

const drawerOpen = ref(false)

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
      : document.querySelector<HTMLElement>('[data-cp-admin-drawer-open]')
    target?.focus()
  })
})
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  const mql = window.matchMedia('(min-width: 768px)')
  const close = () => { drawerOpen.value = false }
  mql.addEventListener('change', close)
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
    mql.removeEventListener('change', close)
  })
})

const ICON_BUTTON =
  'relative flex size-11 items-center justify-center rounded-md text-cp-ink-muted hover:bg-cp-surface-sunken hover:text-cp-ink md:size-10'
</script>

<template>
  <div class="flex min-h-screen bg-cp-canvas text-cp-ink" data-cp-admin-shell>
    <!-- Skip link -->
    <a
      href="#cp-admin-main"
      class="sr-only focus:not-sr-only focus:fixed focus:z-toast focus:top-2 focus:left-2 focus:rounded-md focus:bg-cp-primary focus:text-cp-on-primary focus:px-4 focus:py-2 focus:text-label"
      data-cp-skip-link
    >
      {{ t('cp.shell.skipLink') }}
    </a>

    <!-- Scrim -->
    <div
      class="fixed inset-0 z-drawer bg-cp-scrim transition-opacity duration-200 md:hidden"
      :class="drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'"
      data-cp-scrim
      @click="drawerOpen = false"
    />

    <!-- Sidebar -->
    <aside
      ref="sidebar"
      class="fixed inset-y-0 left-0 z-drawer flex w-sidebar shrink-0 flex-col gap-4 bg-cp-surface-sunken p-4 duration-250 ease-out motion-reduce:transition-none md:sticky md:top-0 md:h-screen md:translate-x-0"
      :class="drawerOpen
        ? 'translate-x-0 transition-transform'
        : '-translate-x-full transition-[transform,visibility] max-md:invisible'"
      :role="drawerOpen ? 'dialog' : undefined"
      :aria-modal="drawerOpen ? 'true' : undefined"
      :aria-label="t('cp.admin.nav')"
      data-cp-sidebar
    >
      <div class="flex items-center justify-between gap-2 px-2">
        <slot name="logo">
          <span class="flex items-center gap-2 font-display text-heading-3 text-cp-ink">
            <UIcon name="i-lucide-sparkles" class="size-5 text-cp-brand-violet" aria-hidden="true" />
            {{ t('cp.shell.logo') }}
            <span class="rounded-pill bg-cp-accent px-2 text-caption font-semibold text-cp-on-accent">
              {{ t('cp.admin.badge') }}
            </span>
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

      <nav class="flex-1 overflow-y-auto" :aria-label="t('cp.admin.nav')">
        <CpSidebarNav :items="navItems" :current-nav="currentNav" size="sm" @navigate="go" />
      </nav>

      <!-- Profil admin en bas -->
      <div class="mt-auto flex items-center gap-3 border-t border-cp-line px-3 pt-3" data-cp-admin-sidebar-profile>
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cp-primary-soft text-label font-semibold text-cp-primary"
          aria-hidden="true"
        >
          {{ userName.slice(0, 1).toUpperCase() }}
        </span>
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-label font-semibold text-cp-ink">{{ userName }}</span>
          <span class="flex items-center gap-1 text-caption text-cp-ink-muted">
            {{ userRole }}
            <template v-if="has2fa">
              <UIcon name="i-lucide-shield-check" class="size-3" aria-hidden="true" />
              <span class="sr-only">{{ t('cp.admin.twoFactor') }}</span>
            </template>
          </span>
        </span>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col" :inert="drawerOpen || undefined">
      <header
        class="sticky top-0 z-sticky flex items-center gap-2 border-b border-cp-line bg-cp-surface px-4 py-2 md:px-6"
        data-cp-admin-topbar
      >
        <button
          type="button"
          :class="[ICON_BUTTON, 'md:hidden']"
          :aria-label="t('cp.shell.openMenu')"
          :aria-expanded="drawerOpen"
          data-cp-admin-drawer-open
          @click="drawerOpen = true"
        >
          <UIcon name="i-lucide-menu" class="size-5" aria-hidden="true" />
        </button>

        <span
          v-if="environmentLabel"
          class="rounded-pill bg-cp-accent-soft px-2.5 py-0.5 text-caption font-semibold text-cp-accent-text"
          data-cp-env-badge
        >
          {{ environmentLabel }}
        </span>

        <button type="button" :class="ICON_BUTTON" :aria-label="t('cp.shell.search')" data-cp-search @click="emit('search')">
          <UIcon name="i-lucide-search" class="size-5" aria-hidden="true" />
        </button>

        <div class="ml-auto flex items-center gap-2">
          <span
            v-if="sessionTimeRemaining"
            class="flex items-center gap-1 text-caption tabular-nums text-cp-ink-muted"
            aria-live="polite"
            data-cp-session-timer
          >
            <UIcon name="i-lucide-clock" class="size-4" aria-hidden="true" />
            {{ t('cp.admin.sessionRemaining', { time: sessionTimeRemaining }) }}
          </span>

          <button
            type="button"
            class="flex min-h-11 items-center gap-2 rounded-md bg-cp-danger px-3 py-1.5 text-label font-semibold text-cp-on-danger hover:bg-cp-danger/85 md:min-h-10"
            :class="{ 'animate-pulse motion-reduce:animate-none': emergencyStopActive }"
            :aria-label="t('cp.admin.emergencyStop')"
            :aria-pressed="emergencyStopActive || undefined"
            data-cp-emergency-stop
            @click="emit('emergency-stop')"
          >
            <UIcon name="i-lucide-octagon" class="size-4" aria-hidden="true" />
            <span class="hidden sm:inline">{{ t('cp.admin.emergencyStop') }}</span>
          </button>

          <button
            type="button"
            :class="ICON_BUTTON"
            :aria-label="t('cp.admin.profile')"
            data-cp-admin-profile
            @click="emit('profile')"
          >
            <span
              class="flex size-8 items-center justify-center rounded-pill bg-cp-primary-soft text-label text-cp-primary"
              aria-hidden="true"
            >
              {{ userName.slice(0, 1).toUpperCase() }}
            </span>
          </button>
        </div>
      </header>

      <main id="cp-admin-main" class="flex-1 px-4 py-6 md:px-8" data-cp-admin-content>
        <slot />
      </main>
    </div>
  </div>
</template>
