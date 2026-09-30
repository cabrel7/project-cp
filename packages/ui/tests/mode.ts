import { mount } from '@vue/test-utils'
import { type Component, defineComponent, h } from 'vue'
import { type CpModeState, provideCpMode } from '../app/composables/useCpMode'

/** Monte un composant sous un fournisseur de mode (Simple par défaut, Technique si `technical`). */
export function mountWithMode(
  component: Component,
  props: Record<string, unknown>,
  options: { technical?: boolean; slots?: Record<string, () => unknown> } = {},
) {
  let state: CpModeState | undefined
  const Host = defineComponent({
    setup() {
      state = provideCpMode(options.technical ?? false)
      return () => h(component, props, options.slots)
    },
  })
  const wrapper = mount(Host)
  return { wrapper, mode: state as CpModeState }
}
