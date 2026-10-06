/**
 * P2.2 — fournisseurs SMS : CA-34 (garde de production), CA-36 (journalisation dev/test), boîte simulée.
 * Règle testée : spec P2.2 §2 (CA-34, CA-36) et §4.5 « SMS ». Aucun appel réseau : le fournisseur
 * simulé est la frontière externe elle-même.
 *
 * Phase RED : les modules `../sms/*` n'existent pas encore → chargement dynamique (un échec par test).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractCode, loadSrc, uniqueCmPhone } from './phone-test-utils.js'

type SimulatedModule = typeof import('../sms/sms.simulated.js')
type UnavailableModule = typeof import('../sms/sms.unavailable.js')
type FactoryModule = typeof import('../sms/sms.factory.js')
type SharedModule = typeof import('@cp/shared')

const PEPPER = 'p'.repeat(40)

const loadSimulated = () => loadSrc<SimulatedModule>('../sms/sms.simulated.js')
const loadUnavailable = () => loadSrc<UnavailableModule>('../sms/sms.unavailable.js')
const loadFactory = () => loadSrc<FactoryModule>('../sms/sms.factory.js')
const loadPhone = () => loadSrc<SharedModule>('@cp/shared')

/** Journal factice : enregistre tous les appels, quel que soit le niveau (info, warn, debug…). */
function recordingLogger() {
  const calls: { level: string; args: unknown[] }[] = []
  const logger = new Proxy(
    {},
    {
      get:
        (_target, level: string) =>
        (...args: unknown[]) => {
          calls.push({ level, args })
        },
    },
  )
  return { logger, calls }
}

const dump = (calls: { level: string; args: unknown[] }[]) =>
  JSON.stringify(calls.map((c) => [c.level, c.args]))

describe('SimulatedSmsProvider — boîte mémoire et garde de production (CA-34, CA-36)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('doit se déclarer disponible sous le nom « simulated »', async () => {
    const { SimulatedSmsProvider } = await loadSimulated()
    const provider = new SimulatedSmsProvider({ nodeEnv: 'test', logger: recordingLogger().logger })
    expect(provider.name).toBe('simulated')
    expect(provider.isAvailable()).toBe(true)
  })

  it('doit ranger le SMS dans la boîte mémoire (destinataire + texte) sans appel réseau', async () => {
    const { SimulatedSmsProvider, getSimulatedOutbox } = await loadSimulated()
    const provider = new SimulatedSmsProvider({ nodeEnv: 'test', logger: recordingLogger().logger })
    const { e164 } = uniqueCmPhone()
    const text =
      '482913 est votre code project-cp. Valable 5 minutes. Ne le partagez avec personne.'

    await provider.send({ to: e164, text })

    const mine = getSimulatedOutbox().filter((m) => m.to === e164)
    expect(mine).toHaveLength(1)
    expect(mine[0]?.text).toBe(text)
    expect(extractCode(mine[0]?.text ?? '')).toBe('482913')
  })

  it('doit conserver l’ordre d’envoi dans la boîte (le dernier SMS est le dernier de la liste)', async () => {
    const { SimulatedSmsProvider, getSimulatedOutbox } = await loadSimulated()
    const provider = new SimulatedSmsProvider({ nodeEnv: 'test', logger: recordingLogger().logger })
    const { e164 } = uniqueCmPhone()

    await provider.send({ to: e164, text: '111111 est votre code project-cp.' })
    await provider.send({ to: e164, text: '222222 est votre code project-cp.' })

    const mine = getSimulatedOutbox().filter((m) => m.to === e164)
    expect(mine.map((m) => extractCode(m.text))).toEqual(['111111', '222222'])
  })

  it('doit lever une erreur à la construction quand NODE_ENV=production (défense en profondeur)', async () => {
    const { SimulatedSmsProvider } = await loadSimulated()
    expect(
      () => new SimulatedSmsProvider({ nodeEnv: 'production', logger: recordingLogger().logger }),
    ).toThrow()
  })

  it('doit lever une erreur à la construction quand env.ts est contourné (NODE_ENV lu via getEnv)', async () => {
    // SMS_PROVIDER absent : en production la valeur par défaut est « none », donc getEnv() réussit ;
    // la garde du constructeur doit malgré tout refuser le fournisseur simulé.
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SMS_PROVIDER', undefined)
    vi.stubEnv('OTP_PEPPER', PEPPER)
    vi.resetModules()
    const { SimulatedSmsProvider } = await loadSimulated()
    expect(() => new SimulatedSmsProvider()).toThrow()
  })

  it('doit journaliser en info {phone_masked, code} avec un avertissement « dev only » en development', async () => {
    const { SimulatedSmsProvider } = await loadSimulated()
    const { maskPhone } = await loadPhone()
    const { logger, calls } = recordingLogger()
    const provider = new SimulatedSmsProvider({ nodeEnv: 'development', logger })
    const { e164 } = uniqueCmPhone()

    await provider.send({ to: e164, text: '482913 est votre code project-cp. Valable 5 minutes.' })

    const infoWithCode = calls.find(
      (c) =>
        c.level === 'info' &&
        c.args.some(
          (a) =>
            typeof a === 'object' &&
            a !== null &&
            (a as Record<string, unknown>).phone_masked === maskPhone(e164) &&
            (a as Record<string, unknown>).code === '482913',
        ),
    )
    expect(infoWithCode, dump(calls)).toBeDefined()
    expect(dump(calls).toLowerCase()).toContain('dev only')
    // le numéro complet ne doit pas figurer dans le journal : seulement sa version masquée
    expect(dump(calls)).not.toContain(e164)
  })

  it('ne doit PAS journaliser le code ni le numéro en test (la boîte mémoire seule le porte)', async () => {
    const { SimulatedSmsProvider, getSimulatedOutbox } = await loadSimulated()
    const { logger, calls } = recordingLogger()
    const provider = new SimulatedSmsProvider({ nodeEnv: 'test', logger })
    const { e164 } = uniqueCmPhone()

    await provider.send({ to: e164, text: '482913 est votre code project-cp.' })

    expect(dump(calls)).not.toContain('482913')
    expect(dump(calls)).not.toContain(e164)
    expect(getSimulatedOutbox().some((m) => m.to === e164)).toBe(true)
  })
})

describe('UnavailableSmsProvider', () => {
  it('doit se déclarer indisponible sous le nom « none »', async () => {
    const { UnavailableSmsProvider } = await loadUnavailable()
    const provider = new UnavailableSmsProvider()
    expect(provider.name).toBe('none')
    expect(provider.isAvailable()).toBe(false)
  })

  it('doit refuser d’envoyer (jamais de succès silencieux)', async () => {
    const { UnavailableSmsProvider } = await loadUnavailable()
    const provider = new UnavailableSmsProvider()
    const { e164 } = uniqueCmPhone()
    await expect(provider.send({ to: e164, text: '123456 est votre code' })).rejects.toThrow()
  })
})

describe('createSmsProvider (CA-34)', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('doit renvoyer UnavailableSmsProvider en production avec SMS_PROVIDER=none', async () => {
    const { createSmsProvider } = await loadFactory()
    const { UnavailableSmsProvider } = await loadUnavailable()
    const provider = createSmsProvider({ NODE_ENV: 'production', SMS_PROVIDER: 'none' })
    expect(provider).toBeInstanceOf(UnavailableSmsProvider)
    expect(provider.isAvailable()).toBe(false)
  })

  it.each(['development', 'test'] as const)(
    'doit renvoyer SimulatedSmsProvider en %s avec SMS_PROVIDER=simulated',
    async (nodeEnv) => {
      const { createSmsProvider } = await loadFactory()
      const { SimulatedSmsProvider } = await loadSimulated()
      const provider = createSmsProvider({ NODE_ENV: nodeEnv, SMS_PROVIDER: 'simulated' })
      expect(provider).toBeInstanceOf(SimulatedSmsProvider)
      expect(provider.isAvailable()).toBe(true)
    },
  )

  it('doit refuser production + simulated même si env.ts est contourné', async () => {
    const { createSmsProvider } = await loadFactory()
    expect(() => createSmsProvider({ NODE_ENV: 'production', SMS_PROVIDER: 'simulated' })).toThrow()
  })

  it('doit permettre de remplacer puis de réinitialiser le fournisseur courant (couture de test)', async () => {
    const { getSmsProvider, setSmsProvider, resetSmsProvider } = await loadFactory()
    const fake = {
      name: 'fake',
      isAvailable: () => true,
      send: async () => {},
    }
    setSmsProvider(fake)
    expect(getSmsProvider()).toBe(fake)
    resetSmsProvider()
    expect(getSmsProvider()).not.toBe(fake)
  })
})
