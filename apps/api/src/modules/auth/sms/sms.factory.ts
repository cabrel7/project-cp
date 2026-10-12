import { getEnv } from '../../../env.js'
import type { SmsProvider } from './sms.provider.js'
import { SimulatedSmsProvider } from './sms.simulated.js'
import { UnavailableSmsProvider } from './sms.unavailable.js'

export interface SmsFactoryEnv {
  NODE_ENV: 'development' | 'production' | 'test'
  SMS_PROVIDER: 'simulated' | 'none'
}

/** Construit le fournisseur selon l'environnement. `production` + `simulated` est refusé même si env.ts est contourné. */
export function createSmsProvider(env: SmsFactoryEnv): SmsProvider {
  if (env.SMS_PROVIDER === 'none') return new UnavailableSmsProvider()
  if (env.NODE_ENV === 'production') {
    throw new Error('SMS_PROVIDER=simulated is forbidden when NODE_ENV=production')
  }
  return new SimulatedSmsProvider({ nodeEnv: env.NODE_ENV })
}

let current: SmsProvider | undefined

export function getSmsProvider(): SmsProvider {
  if (!current) {
    const env = getEnv()
    current = createSmsProvider({ NODE_ENV: env.NODE_ENV, SMS_PROVIDER: env.SMS_PROVIDER })
  }
  return current
}

/** Couture de test : remplace le fournisseur courant. */
export function setSmsProvider(provider: SmsProvider): void {
  current = provider
}

export function resetSmsProvider(): void {
  current = undefined
}
