import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CodeBlock from '../../app/components/Cp/CodeBlock.vue'

const CODE = 'const client = new CpClient()\nawait client.run()'

describe('CpCodeBlock', () => {
  const writeText = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    writeText.mockClear()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  })

  it('affiche le code en texte préformaté monospace sur surface-sunken', () => {
    const wrapper = mount(CodeBlock, { props: { code: CODE } })
    const pre = wrapper.get('pre')
    expect(pre.get('code').text()).toBe(CODE)
    expect(pre.classes()).toEqual(expect.arrayContaining(['font-mono', 'text-code']))
    expect(wrapper.classes()).toContain('bg-cp-surface-sunken')
  })

  it('le bloc défilable est atteignable au clavier', () => {
    expect(
      mount(CodeBlock, { props: { code: CODE } })
        .get('pre')
        .attributes('tabindex'),
    ).toBe('0')
  })

  it('échappe le HTML du code (pas d’injection)', () => {
    const wrapper = mount(CodeBlock, { props: { code: '<script>alert(1)</script>' } })
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.get('code').text()).toBe('<script>alert(1)</script>')
  })

  it('sans langage ni copie : pas de barre d’outils', () => {
    const wrapper = mount(CodeBlock, { props: { code: CODE } })
    expect(wrapper.find('[data-cp-language]').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('affiche le langage', () => {
    const wrapper = mount(CodeBlock, { props: { code: CODE, language: 'typescript' } })
    expect(wrapper.get('[data-cp-language]').text()).toBe('typescript')
  })

  it('copie le code et confirme « Copié »', async () => {
    const wrapper = mount(CodeBlock, { props: { code: CODE, copyable: true } })
    const copy = wrapper.get('[data-cp-copy]')
    expect(copy.text()).toBe('Copier le code')
    expect(copy.attributes('data-icon')).toBe('i-lucide-copy')
    await copy.trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(CODE)
    expect(copy.text()).toBe('Copié')
    expect(copy.attributes('data-icon')).toBe('i-lucide-check')
    expect(wrapper.get('[aria-live="polite"]').text()).toBe('Copié')
  })

  it('retour « Copié » effacé après 2 s', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount(CodeBlock, { props: { code: CODE, copyable: true } })
      await wrapper.get('[data-cp-copy]').trigger('click')
      await flushPromises()
      expect(wrapper.get('[data-cp-copy]').text()).toBe('Copié')
      await vi.advanceTimersByTimeAsync(2100)
      expect(wrapper.get('[data-cp-copy]').text()).toBe('Copier le code')
    } finally {
      vi.useRealTimers()
    }
  })

  it('presse-papiers indisponible : pas de faux « Copié »', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'))
    const wrapper = mount(CodeBlock, { props: { code: CODE, copyable: true } })
    await wrapper.get('[data-cp-copy]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-cp-copy]').text()).toBe('Copier le code')
  })
})
