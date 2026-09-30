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
  verbose: true,
  strict: true,
})
