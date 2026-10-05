import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Skeleton from '../../app/components/Cp/Skeleton.vue'

describe('CpSkeleton', () => {
  it('rend un seul élément par défaut', () => {
    const wrapper = mount(Skeleton, { props: { shape: 'line' } })
    expect(wrapper.findAll('[data-cp-skeleton]')).toHaveLength(1)
  })

  it('rend count éléments', () => {
    const wrapper = mount(Skeleton, { props: { shape: 'line', count: 5 } })
    expect(wrapper.findAll('[data-cp-skeleton]')).toHaveLength(5)
  })

  it('ne rend rien pour count = 0', () => {
    const wrapper = mount(Skeleton, { props: { shape: 'line', count: 0 } })
    expect(wrapper.findAll('[data-cp-skeleton]')).toHaveLength(0)
  })

  it.each([
    ['line', 'h-4'],
    ['tile', 'h-24'],
    ['card', 'h-40'],
  ] as const)('forme %s -> classe %s', (shape, heightClass) => {
    const item = mount(Skeleton, { props: { shape } }).get('[data-cp-skeleton]')
    expect(item.attributes('data-shape')).toBe(shape)
    expect(item.classes()).toContain(heightClass)
  })

  it('utilise le jeton surface-sunken et coupe l’animation si prefers-reduced-motion', () => {
    const item = mount(Skeleton, { props: { shape: 'tile' } }).get('[data-cp-skeleton]')
    expect(item.classes()).toContain('bg-cp-surface-sunken')
    expect(item.classes()).toContain('motion-reduce:animate-none')
  })

  it('annonce le chargement aux lecteurs d’écran', () => {
    const wrapper = mount(Skeleton, { props: { shape: 'card' } })
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.attributes('aria-label')).toBe('Chargement en cours')
  })
})
