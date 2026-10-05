import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CP_TOAST_DURATION, useCpToast } from '../../app/composables/useCpToast'

const nuxtToast = {
  add: vi.fn((toast: Record<string, unknown>) => ({ id: 'toast-1', ...toast })),
  remove: vi.fn(),
  clear: vi.fn(),
}

describe('useCpToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('useToast', () => nuxtToast)
  })

  it('expose success, info, warning, error, remove et clear', () => {
    const toast = useCpToast()
    for (const method of ['success', 'info', 'warning', 'error', 'remove', 'clear'] as const) {
      expect(typeof toast[method]).toBe('function')
    }
  })

  it('utilise une durée de 4000 ms', () => {
    expect(CP_TOAST_DURATION).toBe(4000)
    useCpToast().success('Enregistré')
    expect(nuxtToast.add).toHaveBeenCalledWith(expect.objectContaining({ duration: 4000 }))
  })

  it.each([
    ['success', 'success', 'i-lucide-circle-check'],
    ['info', 'info', 'i-lucide-info'],
    ['warning', 'warning', 'i-lucide-triangle-alert'],
    ['error', 'error', 'i-lucide-circle-alert'],
  ] as const)('%s -> couleur %s et icône %s (statut = icône + mot)', (method, color, icon) => {
    useCpToast()[method]('Message')
    expect(nuxtToast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Message', color, icon }),
    )
  })

  it('affiche un bouton fermer', () => {
    useCpToast().info('Message')
    expect(nuxtToast.add).toHaveBeenCalledWith(expect.objectContaining({ close: true }))
  })

  it('n’ajoute pas d’action sans onUndo', () => {
    useCpToast().success('Message')
    expect(nuxtToast.add).toHaveBeenCalledWith(expect.objectContaining({ actions: undefined }))
  })

  it('ajoute l’action Annuler et la description quand onUndo est fourni', () => {
    const onUndo = vi.fn()
    useCpToast().success('Clé supprimée', { description: 'Elle n’est plus valide', onUndo })
    const arg = nuxtToast.add.mock.calls[0]?.[0] as {
      description: string
      actions: { label: string; onClick: () => void }[]
    }
    expect(arg.description).toBe('Elle n’est plus valide')
    expect(arg.actions).toHaveLength(1)
    expect(arg.actions[0]?.label).toBe('Annuler')
    arg.actions[0]?.onClick()
    expect(onUndo).toHaveBeenCalledOnce()
  })

  it('délègue remove et clear à Nuxt UI', () => {
    const toast = useCpToast()
    toast.remove('toast-1')
    toast.clear()
    expect(nuxtToast.remove).toHaveBeenCalledWith('toast-1')
    expect(nuxtToast.clear).toHaveBeenCalledOnce()
  })
})
