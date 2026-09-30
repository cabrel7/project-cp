import { vi } from 'vitest'
import { ref } from 'vue'
import fr from '../i18n/locales/fr.json'

type Messages = { [key: string]: string | Messages }

const lookup = (key: string): string => {
  let node: string | Messages | undefined = fr as Messages
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined
  }
  return typeof node === 'string' ? node : key
}

/** Espion de `t()` : résout les vrais textes FR et permet de vérifier les clés demandées. */
export const t = vi.fn((key: string, params?: Record<string, unknown>): string => {
  let result = lookup(key)
  for (const [name, value] of Object.entries(params ?? {})) {
    result = result.replaceAll(`{${name}}`, String(value))
  }
  return result
})

export const i18n = { t, locale: ref('fr') }
