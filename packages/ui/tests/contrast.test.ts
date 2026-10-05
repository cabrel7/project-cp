import { describe, expect, it } from 'vitest'
import { colorByName, contrast, declMap, read, rulesWithPrelude } from './helpers'

/**
 * Contrastes WCAG 2.x des paires documentées dans `usage` de tokens.json, mesurés sur les
 * valeurs RÉELLEMENT livrées dans tokens.css (pas sur tokens.json) : si quelqu'un modifie
 * une teinte, l'AA doit rester tenu dans les deux thèmes.
 */
const tokensCss = read('../assets/css/tokens.css')
const values = {
  light: declMap(rulesWithPrelude(tokensCss, ':root')[0]?.body ?? ''),
  dark: declMap(rulesWithPrelude(tokensCss, '.dark')[0]?.body ?? ''),
}
const THEMES = ['light', 'dark'] as const
type Theme = (typeof THEMES)[number]

const hex = (theme: Theme, name: string): string => {
  const value = values[theme].get(`--cp-${name}`)
  if (!value) throw new Error(`--cp-${name} absent (${theme})`)
  return value
}
const ratio = (theme: Theme, fg: string, bg: string): number =>
  contrast(hex(theme, fg), hex(theme, bg))

const SURFACES = ['canvas', 'surface', 'surface-sunken', 'surface-raised']
const SOFTS = [
  'primary-soft',
  'accent-soft',
  'amber-soft',
  'success-soft',
  'warning-soft',
  'danger-soft',
  'info-soft',
]
const AA_TEXT = 4.5
const AA_UI = 3

describe('contraste — texte principal et secondaire', () => {
  it.each(THEMES)(
    'doit avoir ink >= 4,5:1 sur toutes les surfaces et tous les *-soft (%s)',
    (theme) => {
      for (const bg of [...SURFACES, ...SOFTS]) {
        expect(ratio(theme, 'ink', bg), `ink sur ${bg}`).toBeGreaterThanOrEqual(AA_TEXT)
      }
    },
  )

  it.each(THEMES)(
    'doit avoir ink-muted >= 5,8:1 sur toutes les surfaces (valeur documentée) (%s)',
    (theme) => {
      for (const bg of SURFACES) {
        expect(ratio(theme, 'ink-muted', bg), `ink-muted sur ${bg}`).toBeGreaterThanOrEqual(5.8)
      }
    },
  )

  it.each(THEMES)('doit avoir ink-muted >= 4,5:1 sur les *-soft (%s)', (theme) => {
    for (const bg of SOFTS) {
      expect(ratio(theme, 'ink-muted', bg), `ink-muted sur ${bg}`).toBeGreaterThanOrEqual(AA_TEXT)
    }
  })
})

describe('contraste — couleurs d’action, de marque et de statut en texte', () => {
  it.each(THEMES)(
    'doit avoir primary >= 4,5:1 sur toutes les surfaces et primary-soft (%s)',
    (theme) => {
      for (const bg of [...SURFACES, 'primary-soft']) {
        expect(ratio(theme, 'primary', bg), `primary sur ${bg}`).toBeGreaterThanOrEqual(AA_TEXT)
      }
    },
  )

  it.each(THEMES)(
    'doit avoir accent-text >= 4,5:1 sur toutes les surfaces et accent-soft (%s)',
    (theme) => {
      for (const bg of [...SURFACES, 'accent-soft']) {
        expect(ratio(theme, 'accent-text', bg), `accent-text sur ${bg}`).toBeGreaterThanOrEqual(
          AA_TEXT,
        )
      }
    },
  )

  it.each(THEMES)(
    'doit avoir amber-text >= 4,5:1 sur toutes les surfaces et amber-soft (%s)',
    (theme) => {
      for (const bg of [...SURFACES, 'amber-soft']) {
        expect(ratio(theme, 'amber-text', bg), `amber-text sur ${bg}`).toBeGreaterThanOrEqual(
          AA_TEXT,
        )
      }
    },
  )

  it.each(THEMES)(
    'doit avoir chaque statut >= 4,5:1 sur canvas, surface et son fond -soft (%s)',
    (theme) => {
      for (const status of ['success', 'warning', 'danger', 'info']) {
        for (const bg of ['canvas', 'surface', `${status}-soft`]) {
          expect(ratio(theme, status, bg), `${status} sur ${bg}`).toBeGreaterThanOrEqual(AA_TEXT)
        }
      }
    },
  )
})

describe('contraste — textes portés par un fond plein', () => {
  it.each(THEMES)('doit avoir on-primary >= 4,5:1 sur primary (%s)', (theme) => {
    expect(ratio(theme, 'on-primary', 'primary')).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('doit reproduire les rapports documentés : on-primary 6,1:1 / 7,8:1 et on-accent 4,6:1 / 6,9:1', () => {
    expect(ratio('light', 'on-primary', 'primary')).toBeCloseTo(6.1, 1)
    expect(ratio('dark', 'on-primary', 'primary')).toBeCloseTo(7.8, 1)
    expect(ratio('light', 'on-accent', 'accent')).toBeCloseTo(4.6, 1)
    expect(ratio('dark', 'on-accent', 'accent')).toBeCloseTo(6.9, 1)
  })

  it.each(THEMES)('doit avoir on-accent >= 4,5:1 sur accent (%s)', (theme) => {
    expect(ratio(theme, 'on-accent', 'accent')).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it.each(THEMES)('doit avoir on-danger >= 4,5:1 sur danger (%s)', (theme) => {
    expect(ratio(theme, 'on-danger', 'danger')).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('ne doit jamais utiliser du blanc sur accent en clair (règle documentée : « jamais du blanc »)', () => {
    expect(contrast('#ffffff', hex('light', 'accent'))).toBeLessThan(AA_TEXT)
    expect(hex('light', 'on-accent').toLowerCase()).not.toBe('#ffffff')
  })
})

describe('contraste — composants d’interface (>= 3:1)', () => {
  it.each(THEMES)(
    'doit avoir line-strong >= 3:1 sur canvas, surface et surface-sunken (%s)',
    (theme) => {
      for (const bg of ['canvas', 'surface', 'surface-sunken']) {
        expect(ratio(theme, 'line-strong', bg), `line-strong sur ${bg}`).toBeGreaterThanOrEqual(
          AA_UI,
        )
      }
    },
  )

  it.each(THEMES)('doit avoir un anneau de focus >= 3:1 sur toutes les surfaces (%s)', (theme) => {
    for (const bg of SURFACES) {
      expect(ratio(theme, 'focus-ring', bg), `focus-ring sur ${bg}`).toBeGreaterThanOrEqual(AA_UI)
    }
  })

  it('doit garder focus-ring identique à primary dans les deux thèmes (anneau de marque)', () => {
    for (const theme of THEMES) {
      expect(hex(theme, 'focus-ring')).toBe(hex(theme, 'primary'))
    }
  })
})

describe('contraste — la source tokens.json et tokens.css restent alignées', () => {
  it('doit mesurer les mêmes valeurs que tokens.json pour les paires critiques', () => {
    for (const name of ['ink', 'canvas', 'primary', 'on-primary', 'focus-ring']) {
      for (const theme of THEMES) {
        expect(hex(theme, name).toLowerCase()).toBe(colorByName(name).value[theme].toLowerCase())
      }
    }
  })
})
