import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Alert, { type CpAlertVariant } from '../../app/components/Cp/Alert.vue'

const VARIANTS: [CpAlertVariant, string, string, string, string][] = [
  ['info', 'bg-cp-info-soft', 'text-cp-info', 'border-cp-info', 'i-lucide-info'],
  [
    'success',
    'bg-cp-success-soft',
    'text-cp-success',
    'border-cp-success',
    'i-lucide-circle-check',
  ],
  [
    'warning',
    'bg-cp-warning-soft',
    'text-cp-warning',
    'border-cp-warning',
    'i-lucide-triangle-alert',
  ],
  ['danger', 'bg-cp-danger-soft', 'text-cp-danger', 'border-cp-danger', 'i-lucide-circle-alert'],
  ['tip', 'bg-cp-accent-soft', 'text-cp-accent-text', 'border-cp-accent', 'i-lucide-lightbulb'],
]

describe('CpAlert', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
  })

  it.each(VARIANTS)('variante %s -> %s, %s, %s et icône %s', (variant, bg, text, border, icon) => {
    const wrapper = mount(Alert, { props: { variant, title: 'Titre' } })
    expect(wrapper.classes()).toEqual(expect.arrayContaining([bg, border]))
    expect(wrapper.get('p').classes()).toContain(text)
    expect(wrapper.get('[data-icon]').attributes('data-icon')).toBe(icon)
    expect(wrapper.get('[data-icon]').classes()).toContain(text)
  })

  it('affiche titre et description', () => {
    const wrapper = mount(Alert, {
      props: { variant: 'info', title: 'Mise à jour', description: 'Votre accès a été renouvelé.' },
    })
    expect(wrapper.text()).toContain('Mise à jour')
    expect(wrapper.text()).toContain('Votre accès a été renouvelé.')
  })

  it('annonce danger et warning en alert, le reste en status', () => {
    expect(mount(Alert, { props: { variant: 'danger', title: 'x' } }).attributes('role')).toBe(
      'alert',
    )
    expect(mount(Alert, { props: { variant: 'warning', title: 'x' } }).attributes('role')).toBe(
      'alert',
    )
    expect(mount(Alert, { props: { variant: 'info', title: 'x' } }).attributes('role')).toBe(
      'status',
    )
  })

  it('affiche l’action et appelle onClick', async () => {
    const onClick = vi.fn()
    const wrapper = mount(Alert, {
      props: { variant: 'danger', title: 'x', action: { label: 'Réessayer', onClick } },
    })
    const button = wrapper.get('button')
    expect(button.text()).toBe('Réessayer')
    await button.trigger('click')
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('masque code et identifiant de requête en mode Simple', () => {
    const wrapper = mount(Alert, {
      props: {
        variant: 'danger',
        title: 'x',
        errorCode: 'CREDITS_EXHAUSTED',
        requestId: 'req_123',
      },
    })
    expect(wrapper.find('[data-cp-technical]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('CREDITS_EXHAUSTED')
  })

  it('affiche code et identifiant en code-sm mono en mode Technique, sans retirer le reste', () => {
    const wrapper = mount(Alert, {
      props: {
        variant: 'danger',
        title: 'Titre',
        description: 'Explication',
        errorCode: 'CREDITS_EXHAUSTED',
        requestId: 'req_123',
        technicalMode: true,
      },
    })
    const lines = wrapper.findAll('[data-cp-technical] li span.font-mono')
    expect(lines.map((l) => l.text())).toEqual(['Code : CREDITS_EXHAUSTED', 'Requête : req_123'])
    expect(lines[0]?.classes()).toEqual(expect.arrayContaining(['text-code-sm', 'font-mono']))
    expect(wrapper.text()).toContain('Explication')
  })

  it('copie le code dans le presse-papiers', async () => {
    const wrapper = mount(Alert, {
      props: { variant: 'danger', title: 'x', errorCode: 'E_42', technicalMode: true },
    })
    const copyButton = wrapper.get('[data-cp-technical] button')
    expect(copyButton.attributes('aria-label')).toBe('Copier')
    await copyButton.trigger('click')
    await vi.waitFor(() => expect(copyButton.attributes('aria-label')).toBe('Copié'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('E_42')
  })

  it('ne montre le bouton fermer que si dismissible, puis se masque et émet dismiss', async () => {
    expect(
      mount(Alert, { props: { variant: 'info', title: 'x' } })
        .find('button')
        .exists(),
    ).toBe(false)
    const wrapper = mount(Alert, { props: { variant: 'info', title: 'x', dismissible: true } })
    const close = wrapper.get('button')
    expect(close.attributes('aria-label')).toBe('Fermer')
    await close.trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
    expect(wrapper.find('[data-variant]').exists()).toBe(false)
  })

  it('n’utilise aucune couleur en dur', () => {
    const wrapper = mount(Alert, { props: { variant: 'tip', title: 'x' } })
    expect(wrapper.html()).not.toMatch(/#[0-9a-f]{3,8}\b|rgb|hsl|style=/i)
  })
})
