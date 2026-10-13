/**
 * P2.3 — doublures des DEUX frontières externes (SMTP et flux de journaux) partagées par les fichiers d'intégration
 * Google. Module volontairement SANS import de l'application : il est chargé dans les fabriques `vi.mock`
 * (`nodemailer`, `pino`), qui ne doivent pas provoquer l'import circulaire de l'application.
 * Pas de test ici : fichier non collecté par vitest.
 *
 *   vi.mock('nodemailer', async () => (await import('./google-test-mocks.js')).nodemailerMockModule())
 *   vi.mock('pino', async (original) => (await import('./google-test-mocks.js')).pinoCaptureModule(await original()))
 *
 * Le transport SMTP est simulé (frontière externe, comme P2.1) : les e-mails sont lus dans `mailbox.sent`, PAS dans un
 * mock de `auth.email.ts` (le vrai contenu des messages est ainsi vérifié). Les options de production de pino (dont
 * `redact`) sont conservées : seul le flux de sortie est remplacé.
 */

export interface SentMail {
  from?: string
  to: string
  subject: string
  text?: string
  html?: string
}

export const mailbox: { sent: SentMail[]; failing: boolean; attempts: number } = {
  sent: [],
  failing: false,
  attempts: 0,
}

export const logCapture: { lines: string[] } = { lines: [] }

export function nodemailerMockModule() {
  const createTransport = () => ({
    sendMail: async (mail: SentMail) => {
      mailbox.attempts += 1
      if (mailbox.failing) throw new Error('SMTP indisponible (simulé)')
      mailbox.sent.push(mail)
      return { messageId: `test-${mailbox.sent.length}` }
    },
  })
  return { createTransport, default: { createTransport } }
}

export function pinoCaptureModule(actual: Record<string, unknown>) {
  const real = (actual as { default: (...a: unknown[]) => unknown }).default
  const stream = {
    write: (line: string) => {
      logCapture.lines.push(line)
    },
  }
  const wrapped = Object.assign(
    (opts?: unknown, dest?: unknown) => real(opts, dest ?? stream),
    real,
  )
  return { ...actual, default: wrapped }
}

/** Lignes de journal décodées (les lignes non JSON sont ignorées). */
export function parsedLogs(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const line of logCapture.lines) {
    try {
      out.push(JSON.parse(line) as Record<string, unknown>)
    } catch {
      // ligne non JSON : ignorée
    }
  }
  return out
}
