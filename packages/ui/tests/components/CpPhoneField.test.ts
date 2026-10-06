import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import PhoneField from '../../app/components/Cp/PhoneField.vue'

/**
 * CA-41 — CpPhoneField (spec P2.2 §5, D-f) : sélecteur de pays étiqueté + champ tel, erreur accessible,
 * jetons seulement, clair et sombre.
 * Contrat : props `countries[{code,dialCode,label}]`, `v-model:country`, `v-model`, `label`, `hint`,
 * `error`, `disabled` ; libellé du sélecteur = clé i18n `cp.auth.phone.country` (« Pays ») ;
 * hauteur `control-lg` portée par une classe (ex. `h-control-lg`) sur le champ et le sélecteur.
 */
const countries = [
  { code: 'CM', dialCode: '+237', label: 'Cameroun' },
  { code: 'SN', dialCode: '+221', label: 'Sénégal' },
  { code: 'FR', dialCode: '+33', label: 'France' },
]

const mountField = (props: Record<string, unknown> = {}) =>
  mount(PhoneField, {
    props: { label: 'Numéro de téléphone', countries, country: 'CM', modelValue: '', ...props },
  })

const hasLgHeight = (classAttr: string | undefined) =>
  (classAttr ?? '')
    .split(/\s+/)
    .some((c) => c.includes('control-lg') && (!c.includes(':') || c.startsWith('max-')))

describe('CpPhoneField', () => {
  afterEach(() => document.documentElement.classList.remove('dark'))

  it('affiche le libellé du champ et une option par pays avec son indicatif', () => {
    const wrapper = mountField()
    expect(wrapper.get('[data-label]').text()).toBe('Numéro de téléphone')
    const options = wrapper.findAll('option')
    expect(options.map((o) => o.attributes('value'))).toEqual(['CM', 'SN', 'FR'])
    expect(options.map((o) => o.text()).join('|')).toContain('+237')
    expect(options[1]?.text()).toContain('+221')
  })

  it('étiquette le sélecteur de pays (aria-label « Pays »)', () => {
    expect(mountField().get('select').attributes('aria-label')).toBe('Pays')
  })

  it('rend un champ type=tel, inputmode=tel, autocomplete=tel-national', () => {
    const input = mountField().get('input')
    expect(input.attributes('type')).toBe('tel')
    expect(input.attributes('inputmode')).toBe('tel')
    expect(input.attributes('autocomplete')).toBe('tel-national')
  })

  it('applique la hauteur control-lg (mobile) au champ et au sélecteur', () => {
    const wrapper = mountField()
    expect(hasLgHeight(wrapper.get('input').attributes('class'))).toBe(true)
    expect(hasLgHeight(wrapper.get('select').attributes('class'))).toBe(true)
  })

  it('met à jour v-model à la saisie et v-model:country au changement de pays', async () => {
    const wrapper = mountField()
    await wrapper.get('input').setValue('690123442')
    expect(wrapper.emitted('update:modelValue')).toEqual([['690123442']])
    await wrapper.get('select').setValue('SN')
    expect(wrapper.emitted('update:country')).toEqual([['SN']])
  })

  it('affiche l’aide quand il n’y a pas d’erreur et ne marque pas le champ invalide', () => {
    const wrapper = mountField({ hint: 'Nous vous envoyons un code par SMS.' })
    expect(wrapper.get('[data-help]').text()).toBe('Nous vous envoyons un code par SMS.')
    expect(wrapper.get('input').attributes('aria-invalid')).not.toBe('true')
  })

  it('en erreur : aria-invalid, aria-describedby vers le message, icône et texte danger', () => {
    const wrapper = mountField({ hint: 'Aide', error: 'Il manque un chiffre.' })
    const input = wrapper.get('input')
    expect(input.attributes('aria-invalid')).toBe('true')
    const describedBy = input.attributes('aria-describedby')
    expect(describedBy).toBeTruthy()
    const target = wrapper.element.querySelector(`[id="${describedBy}"]`)
    expect(target?.textContent).toContain('Il manque un chiffre.')
    expect(wrapper.find('[data-help]').exists()).toBe(false)
    const error = wrapper.get('[data-error]')
    expect(error.get('[data-icon]').attributes('data-icon')).toBe('i-lucide-circle-alert')
    expect(error.html()).toContain('text-cp-danger')
  })

  it('désactive le champ et le sélecteur quand disabled', () => {
    const wrapper = mountField({ disabled: true })
    expect(wrapper.get('input').element.disabled).toBe(true)
    expect(wrapper.get('select').element.disabled).toBe(true)
  })

  it.each([
    ['clair', false],
    ['sombre', true],
  ])(
    'mode %s : même structure accessible et aucune couleur en dur (jetons seulement)',
    (_mode, dark) => {
      if (dark) document.documentElement.classList.add('dark')
      const wrapper = mountField({ error: 'Numéro invalide' })
      const html = wrapper.html()
      expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
      expect(html).toContain('text-cp-danger')
      expect(html).not.toMatch(
        /#[0-9a-fA-F]{3,8}\b|rgba?\(|text-(red|rose)-\d|bg-(red|rose)-\d|style=/,
      )
    },
  )
})
