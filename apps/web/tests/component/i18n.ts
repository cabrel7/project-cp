import { vi } from 'vitest'
import { ref } from 'vue'
import en from '../../../../packages/ui/i18n/locales/en.json'
import fr from '../../../../packages/ui/i18n/locales/fr.json'

type Messages = { [key: string]: string | Messages }

const lookup = (tree: Messages, key: string): string => {
  let node: string | Messages | undefined = tree
  for (const part of key.split('.')) node = typeof node === 'object' ? node[part] : undefined
  return typeof node === 'string' ? node : key
}

const locale = ref<'fr' | 'en'>('fr')

/** `t()` réel (textes FR/EN du layer) + espion ; une clé absente renvoie la clé elle-même (donc visible dans les tests). */
export const t = vi.fn((key: string, params?: Record<string, unknown>): string => {
  let result = lookup((locale.value === 'en' ? en : fr) as Messages, key)
  for (const [name, value] of Object.entries(params ?? {})) {
    result = result.replaceAll(`{${name}}`, String(value))
  }
  return result
})

export const i18n = { t, locale }
