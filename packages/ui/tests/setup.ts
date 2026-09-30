import { config } from '@vue/test-utils'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  toRef,
  watch,
  watchEffect,
} from 'vue'
import { i18n } from './i18n'
import { nuxtUiStubs } from './stubs'

// D55 : pas de @nuxt/test-utils. Les SFC de packages/ui s'appuient sur les auto-imports de Nuxt
// (useI18n, computed, ref…) : hors Nuxt, on les fournit comme globales (un `vi.mock('#imports')`
// ne suffit pas, il n'intercepte que les imports explicites).
Object.assign(globalThis, {
  useI18n: () => i18n,
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  toRef,
  watch,
  watchEffect,
})

config.global.components = { ...nuxtUiStubs }
