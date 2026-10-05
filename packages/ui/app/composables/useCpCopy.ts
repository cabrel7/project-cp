import { onBeforeUnmount, ref } from 'vue'

/** Copie dans le presse-papiers avec retour « Copié » pendant 2 s (partagé par SecretField et CodeBlock). */
export function useCpCopy(resetDelay = 2000) {
  const copied = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  async function copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value)
      copied.value = true
      clearTimeout(timer)
      timer = setTimeout(() => {
        copied.value = false
      }, resetDelay)
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé) : la valeur reste sélectionnable à l'écran.
    }
  }

  onBeforeUnmount(() => clearTimeout(timer))
  return { copied, copy }
}
