import { describe, expect, it } from 'vitest'
import LayoutEditor from '../../app/components/Cp/LayoutEditor.vue'
import { mountWithMode } from '../mode'

const slots = {
  toolbar: () => 'Barre',
  palette: () => 'Palette',
  canvas: () => 'Canevas',
  properties: () => 'Propriétés',
  list: () => 'Liste',
}

const render = (props: Record<string, unknown> = {}) =>
  mountWithMode(LayoutEditor, props, { slots }).wrapper

describe('CpLayoutEditor', () => {
  it('rend le titre', () => {
    const h2 = render({ title: 'Cartographie' }).get('header h2')
    expect(h2.text()).toBe('Cartographie')
    expect(h2.classes()).toContain('truncate')
  })

  it('le bouton bascule émet toggle-view et porte un libellé', async () => {
    const wrapper = render({ title: 'A' })
    const toggle = wrapper.get('header button')
    expect(toggle.attributes('aria-label')).toBeTruthy()
    expect(toggle.attributes('data-icon')).toBe('i-lucide-list')
    await toggle.trigger('click')
    expect(wrapper.findComponent(LayoutEditor).emitted('toggle-view')).toHaveLength(1)
  })

  it('en listView, rend le slot list et pas le canevas', () => {
    const wrapper = render({ listView: true })
    expect(wrapper.get('[data-cp-editor-list]').text()).toBe('Liste')
    expect(wrapper.find('[data-cp-editor-canvas]').exists()).toBe(false)
    expect(wrapper.get('header button').attributes('data-icon')).toBe('i-lucide-layout-grid')
  })

  it('en mode canevas, rend palette, canvas et properties', () => {
    const wrapper = render()
    expect(wrapper.get('[data-cp-editor-palette]').text()).toBe('Palette')
    expect(wrapper.get('[data-cp-editor-canvas]').text()).toBe('Canevas')
    expect(wrapper.get('[data-cp-editor-properties]').text()).toBe('Propriétés')
    expect(wrapper.find('[data-cp-editor-list]').exists()).toBe(false)
    expect(wrapper.get('header').text()).toContain('Barre')
  })

  it('les panneaux latéraux ont hidden et lg:flex', () => {
    const wrapper = render()
    for (const sel of ['[data-cp-editor-palette]', '[data-cp-editor-properties]']) {
      expect(wrapper.get(sel).classes()).toEqual(expect.arrayContaining(['hidden', 'lg:flex']))
    }
  })

  it('porte data-cp-layout-editor', () => {
    expect(render().find('[data-cp-layout-editor]').exists()).toBe(true)
  })
})
