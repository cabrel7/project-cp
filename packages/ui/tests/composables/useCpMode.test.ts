import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { ensureCpMode, provideCpMode, useCpMode } from '../../app/composables/useCpMode'

/** Exécute `setup` dans un composant monté et renvoie son résultat. */
function run<T>(setup: () => T): T {
  const box: { value?: T } = {}
  mount(
    defineComponent({
      setup() {
        box.value = setup()
        return () => h('div')
      },
    }),
  )
  return box.value as T
}

/** Un parent et son enfant direct, chacun avec son propre setup. */
function tree<P, C>(parentSetup: () => P, childSetup: () => C): { parent: P; child: C } {
  const box: { parent?: P; child?: C } = {}
  const Child = defineComponent({
    setup() {
      box.child = childSetup()
      return () => h('div')
    },
  })
  mount(
    defineComponent({
      setup() {
        box.parent = parentSetup()
        return () => h(Child)
      },
    }),
  )
  return { parent: box.parent as P, child: box.child as C }
}

describe('useCpMode', () => {
  it('Simple par défaut', () => {
    expect(run(() => provideCpMode()).technicalMode.value).toBe(false)
  })

  it('accepte un mode initial Technique', () => {
    expect(run(() => provideCpMode(true)).technicalMode.value).toBe(true)
  })

  it('toggle bascule Simple <-> Technique', () => {
    const { toggle, technicalMode } = run(() => provideCpMode())
    toggle()
    expect(technicalMode.value).toBe(true)
    toggle()
    expect(technicalMode.value).toBe(false)
  })

  it('un descendant partage l état fourni par son ancêtre', () => {
    const { parent, child } = tree(
      () => provideCpMode(),
      () => useCpMode(),
    )
    child.toggle()
    expect(parent.technicalMode.value).toBe(true)
    expect(child.technicalMode.value).toBe(true)
  })

  it('sans fournisseur : état local Simple qui fonctionne quand même', () => {
    const state = run(() => useCpMode())
    expect(state.technicalMode.value).toBe(false)
    state.toggle()
    expect(state.technicalMode.value).toBe(true)
  })

  it('ensureCpMode réutilise l état de la racine au lieu d en créer un', () => {
    const { parent, child } = tree(
      () => provideCpMode(true),
      () => ensureCpMode(),
    )
    expect(child).toBe(parent)
  })

  it('ensureCpMode crée l état s il manque', () => {
    expect(run(() => ensureCpMode()).technicalMode.value).toBe(false)
  })
})
