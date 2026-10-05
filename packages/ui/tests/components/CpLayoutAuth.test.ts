import { describe, expect, it } from 'vitest'
import LayoutAuth from '../../app/components/Cp/LayoutAuth.vue'
import { mountWithMode } from '../mode'

const render = (props: Record<string, unknown> = {}, slots: Record<string, () => unknown> = {}) =>
  mountWithMode(LayoutAuth, { title: 'Autoriser Boutique+', ...props }, { slots }).wrapper

describe('CpLayoutAuth', () => {
  it('rend la carte centrée avec titre et description', () => {
    const wrapper = render({ description: 'Cette application demande l’accès.' })
    expect(wrapper.get('article h1').text()).toBe('Autoriser Boutique+')
    expect(wrapper.get('article p').text()).toBe('Cette application demande l’accès.')
    expect(wrapper.get('[data-cp-layout-auth]').classes()).toEqual(
      expect.arrayContaining(['flex', 'min-h-dvh', 'items-center', 'justify-center']),
    )
  })

  it('affiche l’icône par défaut sans slot header, ou celle fournie', () => {
    expect(render().get('header [data-icon]').attributes('data-icon')).toBe('i-lucide-shield-check')
    expect(
      render({ icon: 'i-lucide-key-round' }).get('header [data-icon]').attributes('data-icon'),
    ).toBe('i-lucide-key-round')
  })

  it('le slot header remplace l’icône par défaut', () => {
    const wrapper = render({}, { header: () => 'Logo' })
    expect(wrapper.find('header [data-icon]').exists()).toBe(false)
    expect(wrapper.get('header').text()).toContain('Logo')
  })

  it('les boutons émettent confirm et cancel', async () => {
    const wrapper = render()
    await wrapper.get('[data-cp-confirm]').trigger('click')
    await wrapper.get('[data-cp-cancel]').trigger('click')
    const inner = wrapper.findComponent(LayoutAuth)
    expect(inner.emitted('confirm')).toHaveLength(1)
    expect(inner.emitted('cancel')).toHaveLength(1)
  })

  it('utilise les libellés fournis', () => {
    const wrapper = render({ confirmLabel: 'Autoriser', cancelLabel: 'Refuser' })
    expect(wrapper.get('[data-cp-confirm]').text()).toBe('Autoriser')
    expect(wrapper.get('[data-cp-cancel]').text()).toBe('Refuser')
  })

  it('rend les slots default et footer', () => {
    const wrapper = render({}, { default: () => 'Permissions', footer: () => 'Mentions' })
    expect(wrapper.text()).toContain('Permissions')
    expect(wrapper.get('footer').text()).toContain('Mentions')
  })

  it('le bouton principal est en loading', () => {
    const wrapper = render({ confirmLoading: true })
    expect(wrapper.get('[data-cp-confirm]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-cp-cancel]').attributes('disabled')).toBeUndefined()
  })

  it('applique max-w-reading-max sur la carte', () => {
    expect(render().get('article').classes()).toContain('max-w-reading-max')
  })

  it('porte data-cp-layout-auth', () => {
    expect(render().find('[data-cp-layout-auth]').exists()).toBe(true)
  })
})
