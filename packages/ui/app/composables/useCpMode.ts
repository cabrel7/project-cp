import { type InjectionKey, inject, provide, type Ref, ref } from 'vue'

/** Mode Simple (défaut) / Technique : le mode Technique AJOUTE des informations, il ne remplace rien. */
export interface CpModeState {
  technicalMode: Ref<boolean>
  toggle: () => void
}

const CP_MODE_KEY: InjectionKey<CpModeState> = Symbol('cp-mode')

function createState(initial: boolean): CpModeState {
  const technicalMode = ref(initial)
  return {
    technicalMode,
    toggle: () => {
      technicalMode.value = !technicalMode.value
    },
  }
}

/** À appeler une fois, à la racine de l'app ou dans AppShell. La persistance (préférence utilisateur) est branchée par l'app. */
export function provideCpMode(initial = false): CpModeState {
  const state = createState(initial)
  provide(CP_MODE_KEY, state)
  return state
}

/** Comme provideCpMode, mais réutilise l'état déjà fourni par un ancêtre (racine de l'app). */
export function ensureCpMode(initial = false): CpModeState {
  return inject(CP_MODE_KEY, null) ?? provideCpMode(initial)
}

/** Lit l'état du mode. Sans fournisseur : état local Simple (composant utilisé isolément). */
export function useCpMode(): CpModeState {
  return inject(CP_MODE_KEY, null) ?? createState(false)
}
