import { config } from '@vue/test-utils'
import { vi } from 'vitest'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  toRef,
  watch,
  watchEffect,
} from 'vue'
import CpAlert from '../../../../packages/ui/app/components/Cp/Alert.vue'
import CpButton from '../../../../packages/ui/app/components/Cp/Button.vue'
import CpConfirmDialog from '../../../../packages/ui/app/components/Cp/ConfirmDialog.vue'
import CpLayoutAuth from '../../../../packages/ui/app/components/Cp/LayoutAuth.vue'
import CpLayoutSettings from '../../../../packages/ui/app/components/Cp/LayoutSettings.vue'
import CpPageHeader from '../../../../packages/ui/app/components/Cp/PageHeader.vue'
import CpSkeleton from '../../../../packages/ui/app/components/Cp/Skeleton.vue'
import { nuxtUiStubs } from '../../../../packages/ui/tests/stubs'
import AccountSignInMethods from '../../app/components/AccountSignInMethods.vue'
import AuthGoogleButton from '../../app/components/AuthGoogleButton.vue'
import AuthSocialButtons from '../../app/components/AuthSocialButtons.vue'
import { i18n } from './i18n'
import { UButton, USeparator } from './stubs'

// Hors Nuxt : les SFC s'appuient sur les auto-imports (useI18n, ref, useSocialLink…). On les fournit comme
// globales, et chaque test règle les doublures des composables via `mocks`.
export const mocks = {
  isOnline: ref(true),
  user: ref<unknown>(null),
  navigateTo: vi.fn(async (_to: unknown) => undefined),
  logout: vi.fn(async (_to?: string) => undefined),
  resendVerification: vi.fn(async () => undefined),
  linkPending: vi.fn(),
  confirmLink: vi.fn(),
  startLinkFromSession: vi.fn(),
  unlink: vi.fn(),
  fetchMe: vi.fn(),
  methods: ref<unknown>(null),
  route: reactive<{ query: Record<string, unknown> }>({ query: {} }),
}

Object.assign(globalThis, {
  useI18n: () => i18n,
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  toRef,
  watch,
  watchEffect,
  definePageMeta: vi.fn(),
  useHead: vi.fn(),
  useRoute: () => mocks.route,
  navigateTo: (to: unknown) => mocks.navigateTo(to),
  useOnlineStatus: () => mocks.isOnline,
  useAuth: () => ({
    user: mocks.user,
    logout: mocks.logout,
    resendVerification: mocks.resendVerification,
    fetchMe: mocks.fetchMe,
  }),
  useSocialLink: () => ({
    linkPending: mocks.linkPending,
    confirmLink: mocks.confirmLink,
    startLinkFromSession: mocks.startLinkFromSession,
    unlink: mocks.unlink,
  }),
  useAuthMethods: () => ({
    methods: mocks.methods,
    buttons: computed(() => {
      const m = (mocks.methods.value ?? {}) as Record<string, unknown>
      const passkey = m.passkey === true
      const google = m.google === true
      const apple = m.apple === true
      return { passkey, google, apple, separator: passkey || google || apple }
    }),
  }),
  // authErrorKey & co. sont importés explicitement par les pages ; les composants utilisent ces auto-imports.
})

config.global.components = {
  ...nuxtUiStubs,
  UButton,
  USeparator,
  CpAlert,
  CpButton,
  CpConfirmDialog,
  CpLayoutAuth,
  CpLayoutSettings,
  CpPageHeader,
  CpSkeleton,
  AccountSignInMethods,
  AuthGoogleButton,
  AuthSocialButtons,
}
