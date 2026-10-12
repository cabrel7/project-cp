/**
 * Utilitaires de test P2.2 (pas de test ici : fichier non collecté par vitest).
 *
 * - `loadSrc` : import dynamique à chemin calculé, relatif à ce dossier. En phase RED, un module de
 *   production absent fait échouer chaque test individuellement (« Cannot find module … ») au lieu de
 *   faire échouer le fichier entier sans aucun test collecté.
 * - Générateurs de numéros / d'IP uniques : les tests d'intégration partagent la base et Redis de dev
 *   (et ceux de la CI) ; aucune valeur fixe ne doit collisionner entre deux exécutions.
 * - Extraction du code depuis la boîte simulée (le code n'est jamais lu en base : il y est haché).
 */
import { randomBytes, randomInt } from 'node:crypto'
import type Redis from 'ioredis'

export const loadSrc = async <T>(relativePath: string): Promise<T> =>
  (await import(/* @vite-ignore */ relativePath)) as T

/** Mobile camerounais valide et unique (+23769XXXXXXX : 69 = opérateur Orange, tous valides pour libphonenumber). */
export function uniqueCmPhone(): { national: string; e164: string } {
  const tail = String(randomInt(0, 10_000_000)).padStart(7, '0')
  const national = `69${tail}`
  return { national, e164: `+237${national}` }
}

/** Mobile sénégalais valide et unique (+22177XXXXXXX). */
export function uniqueSnPhone(): { national: string; e164: string } {
  const tail = String(randomInt(0, 10_000_000)).padStart(7, '0')
  const national = `77${tail}`
  return { national, e164: `+221${national}` }
}

/**
 * IP unique (10.x.y.z, 16 M de valeurs) : jamais partagée entre deux tests ni entre deux exécutions
 * (les compteurs Redis `rl:auth:otp:*:ip:<ip>` survivent 15 min ; aucun nettoyage global n'est fait,
 * car deux fichiers d'intégration tournent en parallèle sur le même Redis).
 */
export function uniqueIp(): string {
  return `10.${randomInt(0, 256)}.${randomInt(0, 256)}.${randomInt(1, 255)}`
}

/** Extrait le code à 6 chiffres d'un texte de SMS (« 123456 est votre code … »). */
export function extractCode(text: string): string {
  const match = text.match(/(?<!\d)(\d{6})(?!\d)/)
  if (!match?.[1]) throw new Error('aucun code à 6 chiffres dans le SMS simulé')
  return match[1]
}

/** Code différent d'un code donné (toujours 6 chiffres, zéros initiaux conservés). */
export function wrongCodeFor(code: string): string {
  return code === '000000' ? '000001' : '000000'
}

/** Liaisons Node simulées pour `app.request(…, env)` : `getClientIp` lit `c.env.incoming.socket`. */
export function socketEnv(remoteAddress: string) {
  return { incoming: { socket: { remoteAddress, remotePort: 54321, remoteFamily: 'IPv4' } } }
}

/**
 * Exclusion mutuelle ENTRE FICHIERS pour une ressource globale de la base partagée (paramètre
 * `free_tier.require_phone_otp`, pays `SN`…) : vitest exécute les fichiers d'intégration en parallèle sur la même
 * base. Tout test qui MODIFIE ou qui ASSERTE la valeur d'un paramètre global doit passer par ce verrou (Redis,
 * `SET NX PX`), sinon un fichier voit transitoirement la valeur de l'autre (tests intermittents).
 */
export async function withGlobalLock<T>(
  redis: Redis,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = `cp:test:lock:${name}`
  const token = randomBytes(8).toString('hex')
  const deadline = Date.now() + 60_000
  while ((await redis.set(key, token, 'PX', 30_000, 'NX')) !== 'OK') {
    if (Date.now() > deadline) throw new Error(`verrou de test « ${name} » non obtenu en 60 s`)
    await new Promise((resolve) => setTimeout(resolve, 40))
  }
  try {
    return await fn()
  } finally {
    if ((await redis.get(key)) === token) await redis.del(key)
  }
}
