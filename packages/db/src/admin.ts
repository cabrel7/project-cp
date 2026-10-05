// Point d'entrée RESTREINT (`@cp/db/admin`) : pool app_admin (BYPASSRLS), réservé à apps/worker et apps/admin.
// Règle guard-rules.tsv : interdit ailleurs → app_rw + withOrgContext.
import { getAdminHandle } from './client.js'

export const getDbAdmin = () => getAdminHandle().db
export const getPoolAdmin = () => getAdminHandle().pool
