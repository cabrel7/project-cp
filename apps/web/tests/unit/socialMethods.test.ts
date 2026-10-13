/**
 * P2.3 — `visibleSocialButtons(methods)` : quels boutons de connexion sociale afficher (CA-25, partie U).
 * Règle (D67, P-3) : un bouton n'apparaît que si son indicateur serveur vaut `true` ; clé d'accès et Apple valent
 * `false` en P2.3 donc restent MASQUÉS. Échec fermé : réponse absente ou invalide = aucun bouton social.
 * Le séparateur « ou » n'apparaît que si au moins un bouton est visible.
 *
 * Phase RED : `app/utils/socialMethods.ts` n'existe pas encore (import dynamique, un échec par test).
 */
import { describe, expect, it } from 'vitest'

type Social = typeof import('../../app/utils/socialMethods')
const MODULE_PATH = '../../app/utils/socialMethods'
const load = async (): Promise<Social> => (await import(/* @vite-ignore */ MODULE_PATH)) as Social

const methods = (flags: { passkey: boolean; google: boolean; apple: boolean }) => ({
  password: true as const,
  phone: true,
  ...flags,
})

describe('visibleSocialButtons — les 8 combinaisons passkey × google × apple (CA-25)', () => {
  const bools = [false, true] as const
  const combos = bools.flatMap((passkey) =>
    bools.flatMap((google) => bools.map((apple) => ({ passkey, google, apple }))),
  )

  it.each(combos)(
    'passkey=$passkey google=$google apple=$apple → chaque bouton suit son indicateur, séparateur si au moins un',
    async (flags) => {
      const { visibleSocialButtons } = await load()
      expect(visibleSocialButtons(methods(flags))).toEqual({
        passkey: flags.passkey,
        google: flags.google,
        apple: flags.apple,
        separator: flags.passkey || flags.google || flags.apple,
      })
    },
  )

  it('doit masquer clé d’accès et Apple et montrer Google avec séparateur quand /methods = {google:true, passkey:false, apple:false}', async () => {
    const { visibleSocialButtons } = await load()
    expect(visibleSocialButtons(methods({ passkey: false, google: true, apple: false }))).toEqual({
      passkey: false,
      google: true,
      apple: false,
      separator: true,
    })
  })

  it('ne doit afficher aucun bouton ni séparateur quand google = false', async () => {
    const { visibleSocialButtons } = await load()
    expect(visibleSocialButtons(methods({ passkey: false, google: false, apple: false }))).toEqual({
      passkey: false,
      google: false,
      apple: false,
      separator: false,
    })
  })
})

describe('visibleSocialButtons — échec fermé', () => {
  const none = { passkey: false, google: false, apple: false, separator: false }

  it.each([[null], [undefined]])(
    'doit ne rien afficher en chargement ou en erreur (%j)',
    async (value) => {
      const { visibleSocialButtons } = await load()
      expect(visibleSocialButtons(value as never)).toEqual(none)
    },
  )

  it('doit ne rien afficher pour un objet vide ou partiel', async () => {
    const { visibleSocialButtons } = await load()
    expect(visibleSocialButtons({} as never)).toEqual(none)
    expect(visibleSocialButtons({ password: true, phone: true } as never)).toEqual(none)
  })

  it('doit exiger un booléen strictement vrai (« true », 1 ou un objet ne comptent pas)', async () => {
    const { visibleSocialButtons } = await load()
    expect(
      visibleSocialButtons({
        password: true,
        phone: true,
        google: 'true',
        passkey: 1,
        apple: {},
      } as never),
    ).toEqual(none)
  })
})
