import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  out: './src/schema',
  dbCredentials: {
    url: process.env['DATABASE_URL']!,
  },
  schemaFilter: [
    'util', 'ref', 'iam', 'storage', 'billing', 'ai', 'mcp',
    'agent', 'usage', 'dev', 'market', 'ux', 'notif',
    'compliance', 'platform', 'audit',
  ],
  // Exclut les partitions enfants (credit_ledger_p202609, usage.runs_default...) : le schéma
  // TypeScript ne doit dépendre ni de la disposition ni des dates de partitionnement (drift CI).
  // Les 9 tables PARENTES partitionnées sont déclarées à la main dans src/schema/partitioned.ts.
  // Négation minimatch : seules les tables qui matchent un motif `!` sont écartées.
  tablesFilter: ['!*_p2*', '!*_default'],
  verbose: true,
  strict: true,
})
