// Confirmation éphémère (4 s, en bas au centre). Jamais pour une erreur bloquante (utiliser CpAlert)
// ni pour un événement externe (centre de notifications). `error` = échec non bloquant d'une action.
// Nommé useCpToast (et non useToast) pour ne pas entrer en collision avec l'auto-import de Nuxt UI.
export const CP_TOAST_DURATION = 4000

export interface CpToastOptions {
  description?: string
  /** Fournir un gestionnaire affiche l'action « Annuler » (action réversible). */
  onUndo?: () => void
}

type CpToastKind = 'success' | 'info' | 'warning' | 'error'

const TOAST_STYLE: Record<CpToastKind, { color: CpToastKind; icon: string }> = {
  success: { color: 'success', icon: 'i-lucide-circle-check' },
  info: { color: 'info', icon: 'i-lucide-info' },
  warning: { color: 'warning', icon: 'i-lucide-triangle-alert' },
  error: { color: 'error', icon: 'i-lucide-circle-alert' },
}

export function useCpToast() {
  const toast = useToast()
  const { t } = useI18n()

  const show = (kind: CpToastKind, message: string, options: CpToastOptions = {}) => {
    const { onUndo, description } = options
    return toast.add({
      title: message,
      description,
      ...TOAST_STYLE[kind],
      duration: CP_TOAST_DURATION,
      // Bouton fermer : son aria-label vient de la locale de Nuxt UI (UApp `locale`).
      close: true,
      actions: onUndo
        ? [{ label: t('cp.toast.undo'), color: 'neutral', variant: 'outline', onClick: onUndo }]
        : undefined,
    })
  }

  return {
    success: (message: string, options?: CpToastOptions) => show('success', message, options),
    info: (message: string, options?: CpToastOptions) => show('info', message, options),
    warning: (message: string, options?: CpToastOptions) => show('warning', message, options),
    error: (message: string, options?: CpToastOptions) => show('error', message, options),
    remove: (id: string) => toast.remove(id),
    clear: () => toast.clear(),
  }
}
