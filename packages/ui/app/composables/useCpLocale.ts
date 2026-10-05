import { en, fr } from '@nuxt/ui/locale'
import { computed } from 'vue'

const locales: Record<string, typeof fr> = { fr, en }

/** Maps the current i18n locale code to the matching Nuxt UI locale object. */
export function useCpLocale() {
  const { locale } = useI18n()
  return computed(() => locales[locale.value] ?? fr)
}
