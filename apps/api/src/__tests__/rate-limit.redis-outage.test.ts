/**
 * Revue P2.2 — panne Redis : `ensureRedisReady` ne doit laisser aucun écouteur `ready` orphelin
 * (chaque requête concurrente pendant une panne en ajoutait un, jamais retiré : fuite mémoire),
 * et doit laisser passer les requêtes (limiteur mémoire d'assurance, CA-31).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { resetEnvCache } from '../env.js'
import { ensureRedisReady, getRedisClient, resetLimiters } from '../middlewares/rate-limit.js'

beforeAll(() => {
  // Port fermé : connexion refusée immédiatement, le client passe en reconnexion.
  vi.stubEnv('REDIS_URL', 'redis://127.0.0.1:1')
  vi.stubEnv('NODE_ENV', 'test')
  resetEnvCache()
  resetLimiters()
})

afterAll(() => {
  resetLimiters()
  vi.unstubAllEnvs()
  resetEnvCache()
})

describe('ensureRedisReady pendant une panne Redis', () => {
  it("doit ne laisser aucun écouteur 'ready' orphelin quand plusieurs requêtes attendent en même temps", async () => {
    const client = getRedisClient()
    const baseline = client.listenerCount('ready')
    await Promise.all(Array.from({ length: 20 }, () => ensureRedisReady()))
    expect(client.listenerCount('ready')).toBe(baseline)
  }, 10_000)

  it('doit rendre la main en moins de 2 s (bascule sur le limiteur mémoire, personne bloqué)', async () => {
    resetLimiters()
    const t0 = performance.now()
    await Promise.all(Array.from({ length: 5 }, () => ensureRedisReady()))
    expect(performance.now() - t0).toBeLessThan(2000)
  }, 10_000)
})
