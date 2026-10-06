// @ts-nocheck — generated circular FK refs
import { pgTable, pgSchema, unique, check, bigint, text, jsonb, boolean, timestamp, uuid, cidr, index, foreignKey, inet, integer, char, smallint, uniqueIndex, numeric, date, type AnyPgColumn, vector, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { bytea, citext, tstzrange } from './custom-types.js'

export const ref = pgSchema("ref");
export const iam = pgSchema("iam");
export const storage = pgSchema("storage");
export const billing = pgSchema("billing");
export const ai = pgSchema("ai");
export const mcp = pgSchema("mcp");
export const agent = pgSchema("agent");
export const dev = pgSchema("dev");
export const usage = pgSchema("usage");
export const market = pgSchema("market");
export const ux = pgSchema("ux");
export const notif = pgSchema("notif");
export const platform = pgSchema("platform");
export const compliance = pgSchema("compliance");
export const audit = pgSchema("audit");
export const util = pgSchema("util");

export const creditLedgerIdSeqInBilling = billing.sequence("credit_ledger_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })
export const runsIdSeqInUsage = usage.sequence("runs_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })
export const runStepsIdSeqInUsage = usage.sequence("run_steps_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })
export const llmRequestsIdSeqInUsage = usage.sequence("llm_requests_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })
export const toolCallsIdSeqInUsage = usage.sequence("tool_calls_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })
export const guardrailEventsIdSeqInUsage = usage.sequence("guardrail_events_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })
export const inboundEventsIdSeqInDev = dev.sequence("inbound_events_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })
export const webhookDeliveriesIdSeqInDev = dev.sequence("webhook_deliveries_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })
export const supportTicketNumberSeqInPlatform = platform.sequence("support_ticket_number_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })
export const eventsIdSeqInAudit = audit.sequence("events_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })

export const staffRolesInPlatform = platform.table("staff_roles", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.staff_roles_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	key: text().notNull(),
	name: jsonb().notNull(),
	description: jsonb(),
	isSystem: boolean("is_system").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("staff_roles_key_key").on(table.key),
	check("staff_roles_key_check", sql`key ~ '^[a-z0-9_]+$'::text`),
	check("staff_roles_name_check", sql`CHECK (util.is_i18n(name`),
]);

export const staffPermissionsInPlatform = platform.table("staff_permissions", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.staff_permissions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	key: text().notNull(),
	module: text().notNull(),
	description: jsonb().notNull(),
	isSensitive: boolean("is_sensitive").default(false).notNull(),
}, (table) => [
	unique("staff_permissions_key_key").on(table.key),
	check("staff_permissions_description_check", sql`CHECK (util.is_i18n(description`),
	check("staff_permissions_key_check", sql`key ~ '^[a-z_]+(\.[a-z_]+)+$'::text`),
]);

export const staffUsersInPlatform = platform.table("staff_users", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.staff_users_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	// customType: citext
	email: citext("email").notNull(),
	fullName: text("full_name").notNull(),
	passwordHash: text("password_hash").notNull(),
	mfaSecretRef: text("mfa_secret_ref"),
	mfaEnrolledAt: timestamp("mfa_enrolled_at", { withTimezone: true, mode: 'string' }),
	allowedIps: cidr("allowed_ips").array(),
	status: text().default('active').notNull(),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("staff_users_public_id_key").on(table.publicId),
	unique("staff_users_email_key").on(table.email),
	check("staff_users_status_check", sql`status = ANY (ARRAY['invited'::text, 'active'::text, 'suspended'::text, 'offboarded'::text])`),
]);

export const staffSessionsInPlatform = platform.table("staff_sessions", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.staff_sessions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	staffUserId: bigint("staff_user_id", { mode: "bigint" }).notNull(),
	// customType: bytea
	tokenHash: bytea("token_hash").notNull(),
	ip: inet().notNull(),
	userAgent: text("user_agent"),
	mfaPassedAt: timestamp("mfa_passed_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("staff_sessions_user_idx").using("btree", table.staffUserId.asc().nullsLast().op("int8_ops")).where(sql`(revoked_at IS NULL)`),
	foreignKey({
			columns: [table.staffUserId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "staff_sessions_staff_user_id_fkey"
		}).onDelete("cascade"),
	unique("staff_sessions_token_hash_key").on(table.tokenHash),
]);

export const staffApiKeysInPlatform = platform.table("staff_api_keys", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.staff_api_keys_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	staffUserId: bigint("staff_user_id", { mode: "bigint" }).notNull(),
	name: text().notNull(),
	prefix: text().notNull(),
	// customType: bytea
	keyHash: bytea("key_hash").notNull(),
	scopes: text().array().notNull(),
	allowedIps: cidr("allowed_ips").array(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("staff_api_keys_user_idx").using("btree", table.staffUserId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.staffUserId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "staff_api_keys_staff_user_id_fkey"
		}).onDelete("cascade"),
	unique("staff_api_keys_public_id_key").on(table.publicId),
	unique("staff_api_keys_prefix_key").on(table.prefix),
	unique("staff_api_keys_key_hash_key").on(table.keyHash),
]);

export const impersonationSessionsInPlatform = platform.table("impersonation_sessions", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.impersonation_sessions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	staffUserId: bigint("staff_user_id", { mode: "bigint" }).notNull(),
	targetUserId: bigint("target_user_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	reason: text().notNull(),
	supportTicketId: bigint("support_ticket_id", { mode: "bigint" }),
	customerConsent: jsonb("customer_consent"),
	readOnly: boolean("read_only").default(true).notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("impersonation_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("impersonation_staff_idx").using("btree", table.staffUserId.asc().nullsLast().op("int8_ops"), table.startedAt.desc().nullsFirst().op("int8_ops")),
	index("impersonation_target_idx").using("btree", table.targetUserId.asc().nullsLast().op("int8_ops")),
	index("impersonation_ticket_idx").using("btree", table.supportTicketId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "impersonation_sessions_organization_id_fkey"
		}),
	foreignKey({
			columns: [table.staffUserId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "impersonation_sessions_staff_user_id_fkey"
		}),
	foreignKey({
			columns: [table.targetUserId],
			foreignColumns: [usersInIam.id],
			name: "impersonation_sessions_target_user_id_fkey"
		}),
	foreignKey({
			columns: [table.supportTicketId],
			foreignColumns: [supportTicketsInPlatform.id],
			name: "impersonation_ticket_fk"
		}).onDelete("set null"),
	unique("impersonation_sessions_public_id_key").on(table.publicId),
]);

export const staffNotesInPlatform = platform.table("staff_notes", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.staff_notes_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	targetType: text("target_type").notNull(),
	targetId: bigint("target_id", { mode: "bigint" }).notNull(),
	staffUserId: bigint("staff_user_id", { mode: "bigint" }).notNull(),
	body: text().notNull(),
	isPinned: boolean("is_pinned").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("staff_notes_staff_idx").using("btree", table.staffUserId.asc().nullsLast().op("int8_ops")),
	index("staff_notes_target_idx").using("btree", table.targetType.asc().nullsLast().op("text_ops"), table.targetId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("int8_ops")),
	foreignKey({
			columns: [table.staffUserId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "staff_notes_staff_user_id_fkey"
		}),
	check("staff_notes_target_type_check", sql`target_type = ANY (ARRAY['organization'::text, 'user'::text, 'listing'::text, 'publisher'::text, 'payment'::text])`),
]);

export const settingsHistoryInPlatform = platform.table("settings_history", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.settings_history_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	key: text().notNull(),
	oldValue: jsonb("old_value"),
	newValue: jsonb("new_value").notNull(),
	changedByStaffId: bigint("changed_by_staff_id", { mode: "bigint" }),
	changedAt: timestamp("changed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("settings_history_key_idx").using("btree", table.key.asc().nullsLast().op("text_ops"), table.changedAt.desc().nullsFirst().op("text_ops")),
	index("settings_history_staff_idx").using("btree", table.changedByStaffId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.changedByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "settings_history_changed_by_staff_id_fkey"
		}).onDelete("set null"),
]);

export const serviceAccountsInPlatform = platform.table("service_accounts", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.service_accounts_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	key: text().notNull(),
	purpose: text().notNull(),
	secretId: bigint("secret_id", { mode: "bigint" }),
	scopes: text().array().default([""]).notNull(),
	lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true, mode: 'string' }),
	rotationDays: integer("rotation_days").default(90).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("service_accounts_secret_idx").using("btree", table.secretId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.secretId],
			foreignColumns: [secretsInIam.id],
			name: "service_accounts_secret_id_fkey"
		}).onDelete("set null"),
	unique("service_accounts_key_key").on(table.key),
]);

export const moderationActionsInPlatform = platform.table("moderation_actions", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.moderation_actions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	targetType: text("target_type").notNull(),
	targetId: bigint("target_id", { mode: "bigint" }).notNull(),
	reportId: bigint("report_id", { mode: "bigint" }),
	action: text().notNull(),
	reason: text().notNull(),
	staffUserId: bigint("staff_user_id", { mode: "bigint" }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("moderation_actions_report_idx").using("btree", table.reportId.asc().nullsLast().op("int8_ops")),
	index("moderation_actions_staff_idx").using("btree", table.staffUserId.asc().nullsLast().op("int8_ops")),
	index("moderation_actions_target_idx").using("btree", table.targetType.asc().nullsLast().op("timestamptz_ops"), table.targetId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("int8_ops")),
	foreignKey({
			columns: [table.reportId],
			foreignColumns: [moderationReportsInPlatform.id],
			name: "moderation_actions_report_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.staffUserId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "moderation_actions_staff_user_id_fkey"
		}),
	check("moderation_actions_action_check", sql`action = ANY (ARRAY['warning'::text, 'suspend'::text, 'remove'::text, 'ban'::text, 'restore'::text])`),
]);

export const currenciesInRef = ref.table("currencies", {
	code: char({ length: 3 }).primaryKey().notNull(),
	name: jsonb().notNull(),
	symbol: text().notNull(),
	minorUnits: smallint("minor_units").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("currencies_code_check", sql`code ~ '^[A-Z]{3}$'::text`),
	check("currencies_minor_units_check", sql`(minor_units >= 0) AND (minor_units <= 4)`),
	check("currencies_name_check", sql`CHECK (util.is_i18n(name`),
]);

export const countriesInRef = ref.table("countries", {
	code: char({ length: 2 }).primaryKey().notNull(),
	name: jsonb().notNull(),
	defaultCurrency: char("default_currency", { length: 3 }).notNull(),
	defaultLanguage: text("default_language").notNull(),
	defaultDataRegionId: bigint("default_data_region_id", { mode: "bigint" }),
	phonePrefix: text("phone_prefix").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	isSignupAllowed: boolean("is_signup_allowed").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("countries_default_currency_idx").using("btree", table.defaultCurrency.asc().nullsLast().op("bpchar_ops")),
	index("countries_default_language_idx").using("btree", table.defaultLanguage.asc().nullsLast().op("text_ops")),
	index("countries_default_region_idx").using("btree", table.defaultDataRegionId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.defaultCurrency],
			foreignColumns: [currenciesInRef.code],
			name: "countries_default_currency_fkey"
		}),
	foreignKey({
			columns: [table.defaultDataRegionId],
			foreignColumns: [dataRegionsInRef.id],
			name: "countries_default_data_region_id_fkey"
		}),
	foreignKey({
			columns: [table.defaultLanguage],
			foreignColumns: [languagesInRef.code],
			name: "countries_default_language_fkey"
		}),
	check("countries_code_check", sql`code ~ '^[A-Z]{2}$'::text`),
	check("countries_name_check", sql`CHECK (util.is_i18n(name`),
	check("countries_phone_prefix_check", sql`phone_prefix ~ '^\+[0-9]{1,4}$'::text`),
]);

export const languagesInRef = ref.table("languages", {
	code: text().primaryKey().notNull(),
	name: jsonb().notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	isDefault: boolean("is_default").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("languages_single_default_uq").using("btree", table.isDefault.asc().nullsLast().op("bool_ops")).where(sql`is_default`),
	check("languages_code_check", sql`code ~ '^[a-z]{2}(-[A-Z]{2})?$'::text`),
	check("languages_name_check", sql`CHECK (util.is_i18n(name`),
]);

export const dataRegionsInRef = ref.table("data_regions", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ref.data_regions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	code: text().notNull(),
	name: jsonb().notNull(),
	hostingProvider: text("hosting_provider").notNull(),
	location: text().notNull(),
	countryCode: char("country_code", { length: 2 }).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	isDefault: boolean("is_default").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("data_regions_single_default_uq").using("btree", table.isDefault.asc().nullsLast().op("bool_ops")).where(sql`is_default`),
	unique("data_regions_public_id_key").on(table.publicId),
	unique("data_regions_code_key").on(table.code),
	check("data_regions_code_check", sql`code ~ '^[a-z0-9-]+$'::text`),
	check("data_regions_name_check", sql`CHECK (util.is_i18n(name`),
]);

export const fxRatesInRef = ref.table("fx_rates", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ref.fx_rates_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	baseCurrency: char("base_currency", { length: 3 }).notNull(),
	quoteCurrency: char("quote_currency", { length: 3 }).notNull(),
	rate: numeric({ precision: 24, scale:  12 }).notNull(),
	source: text().notNull(),
	effectiveAt: timestamp("effective_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fx_rates_quote_idx").using("btree", table.quoteCurrency.asc().nullsLast().op("bpchar_ops")),
	foreignKey({
			columns: [table.baseCurrency],
			foreignColumns: [currenciesInRef.code],
			name: "fx_rates_base_currency_fkey"
		}),
	foreignKey({
			columns: [table.quoteCurrency],
			foreignColumns: [currenciesInRef.code],
			name: "fx_rates_quote_currency_fkey"
		}),
	unique("fx_rates_base_currency_quote_currency_effective_at_key").on(table.baseCurrency, table.effectiveAt, table.quoteCurrency),
	check("fx_rates_check", sql`base_currency <> quote_currency`),
	check("fx_rates_rate_check", sql`rate > (0)::numeric`),
]);

export const taxRatesInRef = ref.table("tax_rates", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ref.tax_rates_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	countryCode: char("country_code", { length: 2 }).notNull(),
	taxType: text("tax_type").notNull(),
	appliesTo: text("applies_to").default('all').notNull(),
	name: jsonb().notNull(),
	rate: numeric({ precision: 7, scale:  4 }).notNull(),
	// customType: tstzrange
	effectiveDuring: tstzrange("effective_during").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countriesInRef.code],
			name: "tax_rates_country_code_fkey"
		}),
	unique("tax_rates_public_id_key").on(table.publicId),
	check("tax_rates_applies_to_check", sql`applies_to = ANY (ARRAY['all'::text, 'subscription'::text, 'credits'::text, 'marketplace'::text])`),
	check("tax_rates_name_check", sql`CHECK (util.is_i18n(name`),
	check("tax_rates_rate_check", sql`(rate >= (0)::numeric) AND (rate < (1)::numeric)`),
	check("tax_rates_tax_type_check", sql`tax_type = ANY (ARRAY['vat'::text, 'sales_tax'::text, 'withholding'::text, 'other'::text])`),
]);

export const userIdentitiesInIam = iam.table("user_identities", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.user_identities_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: bigint("user_id", { mode: "bigint" }).notNull(),
	provider: text().notNull(),
	providerUserId: text("provider_user_id").notNull(),
	// customType: citext
	email: citext("email"),
	profile: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("user_identities_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "user_identities_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_identities_provider_provider_user_id_key").on(table.provider, table.providerUserId),
	check("user_identities_provider_check", sql`provider = ANY (ARRAY['google'::text, 'github'::text, 'microsoft'::text, 'apple'::text])`),
]);

export const userMfaFactorsInIam = iam.table("user_mfa_factors", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.user_mfa_factors_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	userId: bigint("user_id", { mode: "bigint" }).notNull(),
	kind: text().notNull(),
	label: text(),
	secretRef: text("secret_ref").notNull(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("user_mfa_factors_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "user_mfa_factors_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_mfa_factors_public_id_key").on(table.publicId),
	check("user_mfa_factors_kind_check", sql`kind = ANY (ARRAY['totp'::text, 'webauthn'::text, 'sms'::text, 'recovery_codes'::text])`),
]);

export const verificationTokensInIam = iam.table("verification_tokens", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.verification_tokens_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: bigint("user_id", { mode: "bigint" }),
	purpose: text().notNull(),
	target: text().notNull(),
	// customType: bytea
	tokenHash: bytea("token_hash").notNull(),
	attempts: smallint().default(0).notNull(),
	maxAttempts: smallint("max_attempts").default(5).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	consumedAt: timestamp("consumed_at", { withTimezone: true, mode: 'string' }),
	ip: inet(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("verification_tokens_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(consumed_at IS NULL)`),
	index("verification_tokens_target_idx").using("btree", table.target.asc().nullsLast().op("text_ops"), table.purpose.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("verification_tokens_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "verification_tokens_user_id_fkey"
		}).onDelete("cascade"),
	unique("verification_tokens_token_hash_key").on(table.tokenHash),
	check("verification_tokens_attempts_check", sql`attempts >= 0`),
	check("verification_tokens_purpose_check", sql`purpose = ANY (ARRAY['verify_email'::text, 'verify_phone'::text, 'reset_password'::text, 'magic_link'::text, 'otp_login'::text, 'change_email'::text, 'change_phone'::text])`),
]);

export const paymentEventsInBilling = billing.table("payment_events", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.payment_events_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	providerId: bigint("provider_id", { mode: "bigint" }).notNull(),
	paymentId: bigint("payment_id", { mode: "bigint" }),
	externalEventId: text("external_event_id").notNull(),
	eventType: text("event_type").notNull(),
	payload: jsonb().notNull(),
	signatureValid: boolean("signature_valid").notNull(),
	receivedAt: timestamp("received_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	processingError: text("processing_error"),
}, (table) => [
	index("payment_events_payment_idx").using("btree", table.paymentId.asc().nullsLast().op("int8_ops")),
	index("payment_events_unprocessed_idx").using("btree", table.receivedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(processed_at IS NULL)`),
	foreignKey({
			columns: [table.paymentId],
			foreignColumns: [paymentsInBilling.id],
			name: "payment_events_payment_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [paymentProvidersInBilling.id],
			name: "payment_events_provider_id_fkey"
		}),
	unique("payment_events_provider_id_external_event_id_key").on(table.externalEventId, table.providerId),
]);

export const referralsInBilling = billing.table("referrals", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.referrals_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	referrerOrgId: bigint("referrer_org_id", { mode: "bigint" }).notNull(),
	referrerUserId: bigint("referrer_user_id", { mode: "bigint" }),
	referredOrgId: bigint("referred_org_id", { mode: "bigint" }),
	// customType: citext
	code: citext("code").notNull(),
	status: text().default('pending').notNull(),
	qualifiedAt: timestamp("qualified_at", { withTimezone: true, mode: 'string' }),
	rewardGrantId: bigint("reward_grant_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("referrals_code_idx").using("btree", table.code.asc().nullsLast().op("citext_ops")),
	index("referrals_grant_idx").using("btree", table.rewardGrantId.asc().nullsLast().op("int8_ops")),
	index("referrals_referrer_idx").using("btree", table.referrerOrgId.asc().nullsLast().op("int8_ops")),
	index("referrals_referrer_user_idx").using("btree", table.referrerUserId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.referredOrgId],
			foreignColumns: [organizationsInIam.id],
			name: "referrals_referred_org_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.referrerOrgId],
			foreignColumns: [organizationsInIam.id],
			name: "referrals_referrer_org_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.referrerUserId],
			foreignColumns: [usersInIam.id],
			name: "referrals_referrer_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.rewardGrantId],
			foreignColumns: [creditGrantsInBilling.id],
			name: "referrals_reward_grant_id_fkey"
		}).onDelete("set null"),
	unique("referrals_referred_org_id_key").on(table.referredOrgId),
	check("referrals_status_check", sql`status = ANY (ARRAY['pending'::text, 'qualified'::text, 'rewarded'::text, 'rejected'::text])`),
]);

export const payoutsInMarket = market.table("payouts", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "market.payouts_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	publisherId: bigint("publisher_id", { mode: "bigint" }).notNull(),
	currency: char({ length: 3 }).notNull(),
	amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
	periodStart: date("period_start").notNull(),
	periodEnd: date("period_end").notNull(),
	paymentMethodId: bigint("payment_method_id", { mode: "bigint" }),
	status: text().default('pending').notNull(),
	externalRef: text("external_ref"),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("payouts_currency_idx").using("btree", table.currency.asc().nullsLast().op("bpchar_ops")),
	index("payouts_method_idx").using("btree", table.paymentMethodId.asc().nullsLast().op("int8_ops")),
	index("payouts_publisher_idx").using("btree", table.publisherId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("int8_ops")),
	foreignKey({
			columns: [table.currency],
			foreignColumns: [currenciesInRef.code],
			name: "payouts_currency_fkey"
		}),
	foreignKey({
			columns: [table.paymentMethodId],
			foreignColumns: [paymentMethodsInBilling.id],
			name: "payouts_payment_method_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.publisherId],
			foreignColumns: [publishersInMarket.id],
			name: "payouts_publisher_id_fkey"
		}),
	unique("payouts_public_id_key").on(table.publicId),
	check("payouts_amount_minor_check", sql`amount_minor > 0`),
	check("payouts_status_check", sql`status = ANY (ARRAY['pending'::text, 'processing'::text, 'paid'::text, 'failed'::text])`),
]);

export const earningsInMarket = market.table("earnings", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "market.earnings_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publisherId: bigint("publisher_id", { mode: "bigint" }).notNull(),
	listingId: bigint("listing_id", { mode: "bigint" }).notNull(),
	buyerOrgId: bigint("buyer_org_id", { mode: "bigint" }),
	invoiceLineId: bigint("invoice_line_id", { mode: "bigint" }),
	currency: char({ length: 3 }).notNull(),
	grossMinor: bigint("gross_minor", { mode: "bigint" }).notNull(),
	platformFeeMinor: bigint("platform_fee_minor", { mode: "bigint" }).notNull(),
	netMinor: bigint("net_minor", { mode: "bigint" }).notNull(),
	revenueShare: numeric("revenue_share", { precision: 4, scale:  3 }).default('0.700').notNull(),
	status: text().default('pending').notNull(),
	availableAt: timestamp("available_at", { withTimezone: true, mode: 'string' }),
	payoutId: bigint("payout_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("earnings_buyer_idx").using("btree", table.buyerOrgId.asc().nullsLast().op("int8_ops")),
	index("earnings_currency_idx").using("btree", table.currency.asc().nullsLast().op("bpchar_ops")),
	index("earnings_line_idx").using("btree", table.invoiceLineId.asc().nullsLast().op("int8_ops")),
	index("earnings_listing_idx").using("btree", table.listingId.asc().nullsLast().op("int8_ops")),
	index("earnings_payout_idx").using("btree", table.payoutId.asc().nullsLast().op("int8_ops")),
	index("earnings_publisher_idx").using("btree", table.publisherId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.buyerOrgId],
			foreignColumns: [organizationsInIam.id],
			name: "earnings_buyer_org_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.currency],
			foreignColumns: [currenciesInRef.code],
			name: "earnings_currency_fkey"
		}),
	foreignKey({
			columns: [table.invoiceLineId],
			foreignColumns: [invoiceLinesInBilling.id],
			name: "earnings_invoice_line_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.listingId],
			foreignColumns: [listingsInMarket.id],
			name: "earnings_listing_id_fkey"
		}),
	foreignKey({
			columns: [table.payoutId],
			foreignColumns: [payoutsInMarket.id],
			name: "earnings_payout_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.publisherId],
			foreignColumns: [publishersInMarket.id],
			name: "earnings_publisher_id_fkey"
		}),
	check("earnings_check", sql`net_minor = (gross_minor - platform_fee_minor)`),
	check("earnings_status_check", sql`status = ANY (ARRAY['pending'::text, 'available'::text, 'paid'::text, 'reversed'::text])`),
]);

export const cookieConsentsInCompliance = compliance.table("cookie_consents", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "compliance.cookie_consents_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: bigint("user_id", { mode: "bigint" }),
	anonymousId: text("anonymous_id"),
	categories: jsonb().notNull(),
	recordedAt: timestamp("recorded_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	ip: inet(),
}, (table) => [
	index("cookie_consents_anon_idx").using("btree", table.anonymousId.asc().nullsLast().op("text_ops")),
	index("cookie_consents_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops"), table.recordedAt.desc().nullsFirst().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "cookie_consents_user_id_fkey"
		}).onDelete("cascade"),
	check("cookie_consents_check", sql`(user_id IS NOT NULL) OR (anonymous_id IS NOT NULL)`),
]);

export const permissionsInIam = iam.table("permissions", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.permissions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	key: text().notNull(),
	category: text().notNull(),
	description: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("permissions_key_key").on(table.key),
	check("permissions_description_check", sql`CHECK (util.is_i18n(description`),
	check("permissions_key_check", sql`key ~ '^[a-z_]+(\.[a-z_]+)+$'::text`),
]);

export const plansInBilling = billing.table("plans", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.plans_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	key: text().notNull(),
	name: jsonb().notNull(),
	description: jsonb(),
	tier: smallint().notNull(),
	isByokVariant: boolean("is_byok_variant").default(false).notNull(),
	basePlanId: bigint("base_plan_id", { mode: "bigint" }),
	isPublic: boolean("is_public").default(true).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	isCustom: boolean("is_custom").default(false).notNull(),
	sortOrder: smallint("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("plans_base_plan_idx").using("btree", table.basePlanId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.basePlanId],
			foreignColumns: [table.id],
			name: "plans_base_plan_id_fkey"
		}),
	unique("plans_public_id_key").on(table.publicId),
	unique("plans_key_key").on(table.key),
	check("plans_check", sql`(NOT is_byok_variant) OR (base_plan_id IS NOT NULL)`),
	check("plans_key_check", sql`key ~ '^[a-z0-9_]+$'::text`),
	check("plans_name_check", sql`CHECK (util.is_i18n(name`),
]);

export const planPricesInBilling = billing.table("plan_prices", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.plan_prices_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	planId: bigint("plan_id", { mode: "bigint" }).notNull(),
	currency: char({ length: 3 }).notNull(),
	billingInterval: text("billing_interval").notNull(),
	amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
	taxInclusive: boolean("tax_inclusive").default(false).notNull(),
	includedLlmCreditsMicro: bigint("included_llm_credits_micro", { mode: "bigint" }).default(0).notNull(),
	includedInfraCreditsMicro: bigint("included_infra_credits_micro", { mode: "bigint" }).default(0).notNull(),
	llmCoefficient: numeric("llm_coefficient", { precision: 6, scale:  4 }).notNull(),
	// customType: tstzrange
	effectiveDuring: tstzrange("effective_during").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("plan_prices_currency_idx").using("btree", table.currency.asc().nullsLast().op("bpchar_ops")),
	foreignKey({
			columns: [table.currency],
			foreignColumns: [currenciesInRef.code],
			name: "plan_prices_currency_fkey"
		}),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [plansInBilling.id],
			name: "plan_prices_plan_id_fkey"
		}),
	unique("plan_prices_public_id_key").on(table.publicId),
	check("plan_prices_amount_minor_check", sql`amount_minor >= 0`),
	check("plan_prices_billing_interval_check", sql`billing_interval = ANY (ARRAY['month'::text, 'year'::text])`),
	check("plan_prices_included_infra_credits_micro_check", sql`included_infra_credits_micro >= 0`),
	check("plan_prices_included_llm_credits_micro_check", sql`included_llm_credits_micro >= 0`),
	check("plan_prices_llm_coefficient_check", sql`llm_coefficient >= (1)::numeric`),
]);

export const featuresInBilling = billing.table("features", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.features_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	key: text().notNull(),
	category: text().notNull(),
	valueType: text("value_type").notNull(),
	unit: text(),
	name: jsonb().notNull(),
	description: jsonb(),
	sortOrder: smallint("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("features_key_key").on(table.key),
	check("features_key_check", sql`key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'::text`),
	check("features_name_check", sql`CHECK (util.is_i18n(name`),
	check("features_value_type_check", sql`value_type = ANY (ARRAY['boolean'::text, 'integer'::text, 'string'::text, 'string_list'::text])`),
]);

export const creditPacksInBilling = billing.table("credit_packs", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.credit_packs_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	key: text().notNull(),
	kind: text().default('llm').notNull(),
	creditsMicro: bigint("credits_micro", { mode: "bigint" }).notNull(),
	name: jsonb().notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	sortOrder: smallint("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("credit_packs_public_id_key").on(table.publicId),
	unique("credit_packs_key_key").on(table.key),
	check("credit_packs_credits_micro_check", sql`credits_micro > 0`),
	check("credit_packs_kind_check", sql`kind = ANY (ARRAY['llm'::text, 'infra'::text])`),
	check("credit_packs_name_check", sql`CHECK (util.is_i18n(name`),
]);

export const creditPackPricesInBilling = billing.table("credit_pack_prices", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.credit_pack_prices_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	packId: bigint("pack_id", { mode: "bigint" }).notNull(),
	currency: char({ length: 3 }).notNull(),
	amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
	// customType: tstzrange
	effectiveDuring: tstzrange("effective_during").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("credit_pack_prices_currency_idx").using("btree", table.currency.asc().nullsLast().op("bpchar_ops")),
	foreignKey({
			columns: [table.currency],
			foreignColumns: [currenciesInRef.code],
			name: "credit_pack_prices_currency_fkey"
		}),
	foreignKey({
			columns: [table.packId],
			foreignColumns: [creditPacksInBilling.id],
			name: "credit_pack_prices_pack_id_fkey"
		}).onDelete("cascade"),
	check("credit_pack_prices_amount_minor_check", sql`amount_minor > 0`),
]);

export const infraMetersInBilling = billing.table("infra_meters", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.infra_meters_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	key: text().notNull(),
	unit: text().notNull(),
	name: jsonb().notNull(),
	description: jsonb(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("infra_meters_key_key").on(table.key),
	check("infra_meters_key_check", sql`key ~ '^[a-z0-9_]+$'::text`),
	check("infra_meters_name_check", sql`CHECK (util.is_i18n(name`),
]);

export const infraMeterRatesInBilling = billing.table("infra_meter_rates", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.infra_meter_rates_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	meterId: bigint("meter_id", { mode: "bigint" }).notNull(),
	planId: bigint("plan_id", { mode: "bigint" }),
	creditsMicroPerUnit: bigint("credits_micro_per_unit", { mode: "bigint" }).notNull(),
	includedUnitsPerPeriod: bigint("included_units_per_period", { mode: "bigint" }).default(0).notNull(),
	// customType: tstzrange
	effectiveDuring: tstzrange("effective_during").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("infra_meter_rates_plan_idx").using("btree", table.planId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.meterId],
			foreignColumns: [infraMetersInBilling.id],
			name: "infra_meter_rates_meter_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [plansInBilling.id],
			name: "infra_meter_rates_plan_id_fkey"
		}).onDelete("cascade"),
	check("infra_meter_rates_credits_micro_per_unit_check", sql`credits_micro_per_unit >= 0`),
]);

export const paymentProvidersInBilling = billing.table("payment_providers", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.payment_providers_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	key: text().notNull(),
	name: text().notNull(),
	kind: text().notNull(),
	supportedCountries: char("supported_countries", { length: 2 }).array().default([""]).notNull(),
	supportedCurrencies: char("supported_currencies", { length: 3 }).array().default([""]).notNull(),
	supportedMethods: text("supported_methods").array().default([""]).notNull(),
	feeConfig: jsonb("fee_config").default({}).notNull(),
	secretRef: text("secret_ref"),
	priority: smallint().default(100).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("payment_providers_countries_gin").using("gin", table.supportedCountries.asc().nullsLast().op("array_ops")),
	unique("payment_providers_public_id_key").on(table.publicId),
	unique("payment_providers_key_key").on(table.key),
	check("payment_providers_kind_check", sql`kind = ANY (ARRAY['aggregator'::text, 'card'::text, 'bank_transfer'::text, 'manual'::text])`),
]);

export const providersInAi = ai.table("providers", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.providers_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	key: text().notNull(),
	name: text().notNull(),
	kind: text().notNull(),
	website: text(),
	termsNotes: text("terms_notes"),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("providers_public_id_key").on(table.publicId),
	unique("providers_key_key").on(table.key),
	check("providers_key_check", sql`key ~ '^[a-z0-9_-]+$'::text`),
	check("providers_kind_check", sql`kind = ANY (ARRAY['direct'::text, 'cloud'::text, 'inference_host'::text, 'self_hosted'::text])`),
]);

export const modelsInAi = ai.table("models", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.models_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	key: text().notNull(),
	vendor: text().notNull(),
	family: text(),
	displayName: text("display_name").notNull(),
	license: text().notNull(),
	modalitiesIn: text("modalities_in").array().default(["text"]).notNull(),
	modalitiesOut: text("modalities_out").array().default(["text"]).notNull(),
	capabilities: text().array().default([""]).notNull(),
	contextWindow: integer("context_window"),
	maxOutputTokens: integer("max_output_tokens"),
	embeddingDims: integer("embedding_dims"),
	qualityScore: numeric("quality_score", { precision: 5, scale:  2 }),
	speedScore: numeric("speed_score", { precision: 5, scale:  2 }),
	status: text().default('active').notNull(),
	releasedAt: date("released_at"),
	deprecatedAt: date("deprecated_at"),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("models_capabilities_gin").using("gin", table.capabilities.asc().nullsLast().op("array_ops")),
	index("models_modalities_gin").using("gin", table.modalitiesIn.asc().nullsLast().op("array_ops")),
	unique("models_public_id_key").on(table.publicId),
	unique("models_key_key").on(table.key),
	check("models_context_window_check", sql`context_window > 0`),
	check("models_embedding_dims_check", sql`embedding_dims > 0`),
	check("models_license_check", sql`license = ANY (ARRAY['proprietary'::text, 'open_weight'::text])`),
	check("models_max_output_tokens_check", sql`max_output_tokens > 0`),
	check("models_status_check", sql`status = ANY (ARRAY['preview'::text, 'active'::text, 'deprecated'::text, 'disabled'::text])`),
]);

export const modelDeploymentsInAi = ai.table("model_deployments", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.model_deployments_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	modelId: bigint("model_id", { mode: "bigint" }).notNull(),
	providerId: bigint("provider_id", { mode: "bigint" }).notNull(),
	providerAccountId: bigint("provider_account_id", { mode: "bigint" }),
	providerModelName: text("provider_model_name").notNull(),
	litellmRoute: text("litellm_route").notNull(),
	priority: smallint().default(100).notNull(),
	weight: smallint().default(100).notNull(),
	zeroDataRetention: boolean("zero_data_retention").default(false).notNull(),
	processingRegion: text("processing_region"),
	allowsPlatformKeys: boolean("allows_platform_keys").default(true).notNull(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("model_deployments_account_idx").using("btree", table.providerAccountId.asc().nullsLast().op("int8_ops")),
	index("model_deployments_model_idx").using("btree", table.modelId.asc().nullsLast().op("int8_ops"), table.priority.asc().nullsLast().op("int2_ops")).where(sql`(status = 'active'::text)`),
	index("model_deployments_provider_idx").using("btree", table.providerId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.modelId],
			foreignColumns: [modelsInAi.id],
			name: "model_deployments_model_id_fkey"
		}),
	foreignKey({
			columns: [table.providerAccountId],
			foreignColumns: [providerAccountsInAi.id],
			name: "model_deployments_provider_account_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [providersInAi.id],
			name: "model_deployments_provider_id_fkey"
		}),
	unique("model_deployments_public_id_key").on(table.publicId),
	unique("model_deployments_litellm_route_key").on(table.litellmRoute),
	check("model_deployments_status_check", sql`status = ANY (ARRAY['active'::text, 'degraded'::text, 'disabled'::text])`),
	check("model_deployments_weight_check", sql`weight >= 0`),
]);

export const modelPricesInAi = ai.table("model_prices", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.model_prices_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	deploymentId: bigint("deployment_id", { mode: "bigint" }).notNull(),
	unit: text().notNull(),
	unitPriceUsd: numeric("unit_price_usd", { precision: 24, scale:  14 }).notNull(),
	tierCondition: jsonb("tier_condition"),
	// customType: tstzrange
	effectiveDuring: tstzrange("effective_during").notNull(),
	source: text().default('manual').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.deploymentId],
			foreignColumns: [modelDeploymentsInAi.id],
			name: "model_prices_deployment_id_fkey"
		}).onDelete("cascade"),
	check("model_prices_unit_check", sql`unit = ANY (ARRAY['input_token'::text, 'output_token'::text, 'cached_input_token'::text, 'cache_write_token'::text, 'reasoning_token'::text, 'embedding_token'::text, 'image_input'::text, 'image_output'::text, 'audio_input_second'::text, 'audio_output_second'::text, 'tts_character'::text, 'document_page'::text, 'video_second'::text, 'request'::text])`),
	check("model_prices_unit_price_usd_check", sql`unit_price_usd >= (0)::numeric`),
]);

export const connectorDefinitionsInMcp = mcp.table("connector_definitions", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "mcp.connector_definitions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	key: text().notNull(),
	kind: text().notNull(),
	name: text().notNull(),
	description: jsonb().notNull(),
	iconFileId: bigint("icon_file_id", { mode: "bigint" }),
	authTypes: text("auth_types").array().default([""]).notNull(),
	configSchema: jsonb("config_schema").default({}).notNull(),
	defaultActions: jsonb("default_actions").default([]).notNull(),
	publisher: text().default('official').notNull(),
	version: text().default('1.0.0').notNull(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("connector_definitions_icon_idx").using("btree", table.iconFileId.asc().nullsLast().op("int8_ops")),
	index("connector_definitions_name_trgm").using("gin", table.name.asc().nullsLast().op("gin_trgm_ops")),
	foreignKey({
			columns: [table.iconFileId],
			foreignColumns: [filesInStorage.id],
			name: "connector_definitions_icon_file_id_fkey"
		}).onDelete("set null"),
	unique("connector_definitions_public_id_key").on(table.publicId),
	unique("connector_definitions_key_key").on(table.key),
	check("connector_definitions_description_check", sql`CHECK (util.is_i18n(description`),
	check("connector_definitions_key_check", sql`key ~ '^[a-z0-9_.-]+$'::text`),
	check("connector_definitions_kind_check", sql`kind = ANY (ARRAY['saas'::text, 'google_workspace'::text, 'database'::text, 'payment'::text, 'messaging'::text, 'other'::text])`),
	check("connector_definitions_publisher_check", sql`publisher = ANY (ARRAY['official'::text, 'marketplace'::text])`),
	check("connector_definitions_status_check", sql`status = ANY (ARRAY['beta'::text, 'active'::text, 'deprecated'::text, 'disabled'::text])`),
]);

export const categoriesInMarket = market.table("categories", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "market.categories_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	key: text().notNull(),
	name: jsonb().notNull(),
	parentId: bigint("parent_id", { mode: "bigint" }),
	sortOrder: smallint("sort_order").default(0).notNull(),
}, (table) => [
	index("categories_parent_idx").using("btree", table.parentId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "categories_parent_id_fkey"
		}),
	unique("categories_key_key").on(table.key),
	check("categories_name_check", sql`CHECK (util.is_i18n(name`),
]);

export const legalDocumentsInCompliance = compliance.table("legal_documents", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "compliance.legal_documents_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	kind: text().notNull(),
	version: text().notNull(),
	locale: text().notNull(),
	contentMd: text("content_md"),
	fileId: bigint("file_id", { mode: "bigint" }),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	isCurrent: boolean("is_current").default(false).notNull(),
	requiresReacceptance: boolean("requires_reacceptance").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("legal_documents_current_uq").using("btree", table.kind.asc().nullsLast().op("text_ops"), table.locale.asc().nullsLast().op("text_ops")).where(sql`is_current`),
	index("legal_documents_file_idx").using("btree", table.fileId.asc().nullsLast().op("int8_ops")),
	index("legal_documents_locale_idx").using("btree", table.locale.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [filesInStorage.id],
			name: "legal_documents_file_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.locale],
			foreignColumns: [languagesInRef.code],
			name: "legal_documents_locale_fkey"
		}),
	unique("legal_documents_public_id_key").on(table.publicId),
	unique("legal_documents_kind_version_locale_key").on(table.kind, table.locale, table.version),
	check("legal_documents_kind_check", sql`kind = ANY (ARRAY['terms'::text, 'privacy'::text, 'dpa'::text, 'marketplace_terms'::text, 'publisher_agreement'::text, 'cookies'::text, 'aup'::text])`),
]);

export const processingActivitiesInCompliance = compliance.table("processing_activities", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "compliance.processing_activities_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	name: text().notNull(),
	purpose: text().notNull(),
	legalBasis: text("legal_basis").notNull(),
	dataCategories: text("data_categories").array().notNull(),
	dataSubjects: text("data_subjects").array().notNull(),
	recipients: text().array().default([""]).notNull(),
	transfers: jsonb().default([]).notNull(),
	retention: text().notNull(),
	securityMeasures: text("security_measures").notNull(),
	dpiaRequired: boolean("dpia_required").default(false).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("processing_activities_name_key").on(table.name),
]);

export const subprocessorsInCompliance = compliance.table("subprocessors", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "compliance.subprocessors_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	name: text().notNull(),
	purpose: text().notNull(),
	location: text().notNull(),
	dpaUrl: text("dpa_url"),
	isPublic: boolean("is_public").default(true).notNull(),
	addedAt: date("added_at").default(sql`CURRENT_DATE`).notNull(),
	removedAt: date("removed_at"),
});

export const couponsInBilling = billing.table("coupons", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.coupons_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	// customType: citext
	code: citext("code").notNull(),
	kind: text().notNull(),
	value: numeric({ precision: 18, scale:  4 }).notNull(),
	currency: char({ length: 3 }),
	creditsExpireDays: integer("credits_expire_days"),
	applicablePlanIds: bigint("applicable_plan_ids", { mode: "bigint" }).array(),
	maxRedemptions: integer("max_redemptions"),
	maxPerOrg: integer("max_per_org").default(1).notNull(),
	validFrom: timestamp("valid_from", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	validUntil: timestamp("valid_until", { withTimezone: true, mode: 'string' }),
	isActive: boolean("is_active").default(true).notNull(),
	createdByStaffId: bigint("created_by_staff_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("coupons_currency_idx").using("btree", table.currency.asc().nullsLast().op("bpchar_ops")),
	index("coupons_staff_idx").using("btree", table.createdByStaffId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.currency],
			foreignColumns: [currenciesInRef.code],
			name: "coupons_currency_fkey"
		}),
	foreignKey({
			columns: [table.createdByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "coupons_staff_fk"
		}).onDelete("set null"),
	unique("coupons_public_id_key").on(table.publicId),
	unique("coupons_code_key").on(table.code),
	check("coupons_kind_check", sql`kind = ANY (ARRAY['credits'::text, 'percent_off'::text, 'amount_off'::text])`),
	check("coupons_value_check", sql`value > (0)::numeric`),
]);

export const guardrailDetectorsInAi = ai.table("guardrail_detectors", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.guardrail_detectors_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	key: text().notNull(),
	stage: text().notNull(),
	engine: text().notNull(),
	modelId: bigint("model_id", { mode: "bigint" }),
	localModelRef: text("local_model_ref"),
	latencyBudgetMs: integer("latency_budget_ms").notNull(),
	costTier: text("cost_tier").default('free').notNull(),
	defaultParams: jsonb("default_params").default({}).notNull(),
	name: jsonb().notNull(),
	description: jsonb(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("guardrail_detectors_model_idx").using("btree", table.modelId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.modelId],
			foreignColumns: [modelsInAi.id],
			name: "guardrail_detectors_model_id_fkey"
		}),
	unique("guardrail_detectors_key_key").on(table.key),
	check("guardrail_detectors_cost_tier_check", sql`cost_tier = ANY (ARRAY['free'::text, 'low'::text, 'medium'::text, 'high'::text])`),
	check("guardrail_detectors_engine_check", sql`engine = ANY (ARRAY['regex'::text, 'deterministic'::text, 'classifier_local'::text, 'classifier_remote'::text, 'llm_judge'::text, 'policy'::text])`),
	check("guardrail_detectors_key_check", sql`key ~ '^[a-z0-9_]+$'::text`),
	check("guardrail_detectors_latency_budget_ms_check", sql`latency_budget_ms > 0`),
	check("guardrail_detectors_name_check", sql`CHECK (util.is_i18n(name`),
	check("guardrail_detectors_stage_check", sql`stage = ANY (ARRAY['input'::text, 'context'::text, 'tool_call'::text, 'output'::text, 'cost'::text])`),
]);

export const providerAccountsInAi = ai.table("provider_accounts", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.provider_accounts_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	providerId: bigint("provider_id", { mode: "bigint" }).notNull(),
	label: text().notNull(),
	legalEntity: text("legal_entity"),
	secretId: bigint("secret_id", { mode: "bigint" }),
	tier: text(),
	rateLimits: jsonb("rate_limits").default({}).notNull(),
	billingMode: text("billing_mode").default('prepaid').notNull(),
	balanceCurrency: char("balance_currency", { length: 3 }),
	lowBalanceThresholdMinor: bigint("low_balance_threshold_minor", { mode: "bigint" }),
	autoReloadEnabled: boolean("auto_reload_enabled").default(false).notNull(),
	status: text().default('active').notNull(),
	region: text(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("provider_accounts_currency_idx").using("btree", table.balanceCurrency.asc().nullsLast().op("bpchar_ops")),
	index("provider_accounts_provider_idx").using("btree", table.providerId.asc().nullsLast().op("int8_ops")),
	index("provider_accounts_secret_idx").using("btree", table.secretId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.balanceCurrency],
			foreignColumns: [currenciesInRef.code],
			name: "provider_accounts_balance_currency_fkey"
		}),
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [providersInAi.id],
			name: "provider_accounts_provider_id_fkey"
		}),
	foreignKey({
			columns: [table.secretId],
			foreignColumns: [secretsInIam.id],
			name: "provider_accounts_secret_id_fkey"
		}).onDelete("set null"),
	unique("provider_accounts_public_id_key").on(table.publicId),
	check("provider_accounts_billing_mode_check", sql`billing_mode = ANY (ARRAY['prepaid'::text, 'postpaid'::text, 'commitment'::text])`),
	check("provider_accounts_status_check", sql`status = ANY (ARRAY['active'::text, 'limited'::text, 'suspended'::text, 'disabled'::text])`),
]);

export const providerAccountSnapshotsInAi = ai.table("provider_account_snapshots", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.provider_account_snapshots_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	providerAccountId: bigint("provider_account_id", { mode: "bigint" }).notNull(),
	balanceMinor: bigint("balance_minor", { mode: "bigint" }),
	spendPeriodMinor: bigint("spend_period_minor", { mode: "bigint" }),
	currency: char({ length: 3 }).notNull(),
	capturedAt: timestamp("captured_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	source: text().default('api').notNull(),
}, (table) => [
	index("provider_account_snapshots_currency_idx").using("btree", table.currency.asc().nullsLast().op("bpchar_ops")),
	index("provider_account_snapshots_idx").using("btree", table.providerAccountId.asc().nullsLast().op("int8_ops"), table.capturedAt.desc().nullsFirst().op("int8_ops")),
	foreignKey({
			columns: [table.currency],
			foreignColumns: [currenciesInRef.code],
			name: "provider_account_snapshots_currency_fkey"
		}),
	foreignKey({
			columns: [table.providerAccountId],
			foreignColumns: [providerAccountsInAi.id],
			name: "provider_account_snapshots_provider_account_id_fkey"
		}).onDelete("cascade"),
]);

export const dataBreachesInCompliance = compliance.table("data_breaches", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "compliance.data_breaches_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	detectedAt: timestamp("detected_at", { withTimezone: true, mode: 'string' }).notNull(),
	description: text().notNull(),
	severity: text().notNull(),
	affectedOrgIds: bigint("affected_org_ids", { mode: "bigint" }).array().default([]).notNull(),
	affectedSubjectsEst: integer("affected_subjects_est"),
	dataCategories: text("data_categories").array().default([""]).notNull(),
	authorityNotifiedAt: timestamp("authority_notified_at", { withTimezone: true, mode: 'string' }),
	subjectsNotifiedAt: timestamp("subjects_notified_at", { withTimezone: true, mode: 'string' }),
	measures: text(),
	status: text().default('open').notNull(),
	ownerStaffId: bigint("owner_staff_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("data_breaches_staff_idx").using("btree", table.ownerStaffId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.ownerStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "data_breaches_owner_staff_id_fkey"
		}).onDelete("set null"),
	unique("data_breaches_public_id_key").on(table.publicId),
	check("data_breaches_severity_check", sql`severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])`),
	check("data_breaches_status_check", sql`status = ANY (ARRAY['open'::text, 'contained'::text, 'closed'::text])`),
]);

export const transferAuthorizationsInCompliance = compliance.table("transfer_authorizations", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "compliance.transfer_authorizations_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	authority: text().notNull(),
	reference: text(),
	scope: text().notNull(),
	destination: text().notNull(),
	status: text().default('requested').notNull(),
	requestedAt: date("requested_at").notNull(),
	grantedAt: date("granted_at"),
	expiresAt: date("expires_at"),
	fileId: bigint("file_id", { mode: "bigint" }),
}, (table) => [
	index("transfer_authorizations_file_idx").using("btree", table.fileId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [filesInStorage.id],
			name: "transfer_authorizations_file_id_fkey"
		}).onDelete("set null"),
	check("transfer_authorizations_status_check", sql`status = ANY (ARRAY['requested'::text, 'granted'::text, 'refused'::text, 'expired'::text])`),
]);

export const backendsInStorage = storage.table("backends", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "storage.backends_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	key: text().notNull(),
	name: jsonb().notNull(),
	kind: text().notNull(),
	provider: text().notNull(),
	endpoint: text().notNull(),
	region: text().default('us-east-1').notNull(),
	bucket: text().notNull(),
	forcePathStyle: boolean("force_path_style").default(true).notNull(),
	credentialsSecretRef: text("credentials_secret_ref").notNull(),
	dataRegionId: bigint("data_region_id", { mode: "bigint" }).notNull(),
	status: text().default('active').notNull(),
	isWriteTarget: boolean("is_write_target").default(false).notNull(),
	capacityBytes: bigint("capacity_bytes", { mode: "bigint" }),
	alertThresholdPct: smallint("alert_threshold_pct").default(80).notNull(),
	lockVersion: integer("lock_version").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("backends_one_write_target_per_region").using("btree", table.dataRegionId.asc().nullsLast().op("int8_ops")).where(sql`is_write_target`),
	index("backends_region_idx").using("btree", table.dataRegionId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.dataRegionId],
			foreignColumns: [dataRegionsInRef.id],
			name: "backends_data_region_id_fkey"
		}),
	unique("backends_public_id_key").on(table.publicId),
	unique("backends_key_key").on(table.key),
	check("backends_alert_threshold_pct_check", sql`(alert_threshold_pct >= 50) AND (alert_threshold_pct <= 99)`),
	check("backends_capacity_bytes_check", sql`(capacity_bytes IS NULL) OR (capacity_bytes > 0)`),
	check("backends_key_check", sql`key ~ '^[a-z][a-z0-9_]{1,40}$'::text`),
	check("backends_kind_check", sql`kind = ANY (ARRAY['seaweedfs'::text, 's3'::text])`),
	check("backends_name_check", sql`CHECK (util.is_i18n(name`),
	check("backends_provider_check", sql`provider = ANY (ARRAY['self_hosted'::text, 'ovh'::text, 'other'::text])`),
	check("backends_status_check", sql`status = ANY (ARRAY['active'::text, 'read_only'::text, 'draining'::text, 'disabled'::text])`),
	check("backends_write_target_active", sql`(NOT is_write_target) OR (status = 'active'::text)`),
]);

export const backendMigrationsInStorage = storage.table("backend_migrations", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "storage.backend_migrations_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	fromBackendId: bigint("from_backend_id", { mode: "bigint" }).notNull(),
	toBackendId: bigint("to_backend_id", { mode: "bigint" }).notNull(),
	status: text().default('queued').notNull(),
	deleteSource: boolean("delete_source").default(true).notNull(),
	filesTotal: bigint("files_total", { mode: "bigint" }).default(0).notNull(),
	filesDone: bigint("files_done", { mode: "bigint" }).default(0).notNull(),
	filesFailed: bigint("files_failed", { mode: "bigint" }).default(0).notNull(),
	bytesTotal: bigint("bytes_total", { mode: "bigint" }).default(0).notNull(),
	bytesDone: bigint("bytes_done", { mode: "bigint" }).default(0).notNull(),
	lastFileId: bigint("last_file_id", { mode: "bigint" }),
	reason: text().notNull(),
	startedByStaffUserId: bigint("started_by_staff_user_id", { mode: "bigint" }),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	lastError: text("last_error"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("backend_migrations_from_idx").using("btree", table.fromBackendId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("backend_migrations_one_active").using("btree", table.fromBackendId.asc().nullsLast().op("int8_ops")).where(sql`(status = ANY (ARRAY['queued'::text, 'running'::text, 'paused'::text]))`),
	index("backend_migrations_staff_idx").using("btree", table.startedByStaffUserId.asc().nullsLast().op("int8_ops")),
	index("backend_migrations_to_idx").using("btree", table.toBackendId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.fromBackendId],
			foreignColumns: [backendsInStorage.id],
			name: "backend_migrations_from_backend_id_fkey"
		}),
	foreignKey({
			columns: [table.startedByStaffUserId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "backend_migrations_staff_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.toBackendId],
			foreignColumns: [backendsInStorage.id],
			name: "backend_migrations_to_backend_id_fkey"
		}),
	unique("backend_migrations_public_id_key").on(table.publicId),
	check("backend_migrations_bytes_done_check", sql`bytes_done >= 0`),
	check("backend_migrations_bytes_total_check", sql`bytes_total >= 0`),
	check("backend_migrations_distinct", sql`from_backend_id <> to_backend_id`),
	check("backend_migrations_files_done_check", sql`files_done >= 0`),
	check("backend_migrations_files_failed_check", sql`files_failed >= 0`),
	check("backend_migrations_files_total_check", sql`files_total >= 0`),
	check("backend_migrations_progress", sql`((files_done + files_failed) <= files_total) OR (files_total = 0)`),
	check("backend_migrations_reason_check", sql`length(reason) >= 5`),
	check("backend_migrations_status_check", sql`status = ANY (ARRAY['queued'::text, 'running'::text, 'paused'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])`),
]);

export const featureFlagsInPlatform = platform.table("feature_flags", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.feature_flags_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	key: text().notNull(),
	description: text(),
	kind: text().default('boolean').notNull(),
	defaultValue: jsonb("default_value").default(false).notNull(),
	isEnabled: boolean("is_enabled").default(false).notNull(),
	targeting: jsonb().default({}).notNull(),
	owner: text(),
	updatedByStaffId: bigint("updated_by_staff_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("feature_flags_staff_idx").using("btree", table.updatedByStaffId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.updatedByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "feature_flags_updated_by_staff_id_fkey"
		}).onDelete("set null"),
	unique("feature_flags_key_key").on(table.key),
	check("feature_flags_key_check", sql`key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'::text`),
	check("feature_flags_kind_check", sql`kind = ANY (ARRAY['boolean'::text, 'percentage'::text, 'variant'::text])`),
]);

export const errorCodesInPlatform = platform.table("error_codes", {
	code: text().primaryKey().notNull(),
	category: text().notNull(),
	httpStatus: smallint("http_status").notNull(),
	message: jsonb().notNull(),
	hint: jsonb(),
	isRetryable: boolean("is_retryable").default(false).notNull(),
	refundsCredits: boolean("refunds_credits").default(false).notNull(),
	docPath: text("doc_path"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("error_codes_code_check", sql`code ~ '^[A-Z][A-Z0-9_]+$'::text`),
	check("error_codes_message_check", sql`CHECK (util.is_i18n(message`),
]);

export const messageTemplatesInPlatform = platform.table("message_templates", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.message_templates_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	key: text().notNull(),
	channel: text().notNull(),
	locale: text().notNull(),
	version: integer().default(1).notNull(),
	subject: text(),
	body: text().notNull(),
	variables: jsonb().default([]).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	updatedByStaffId: bigint("updated_by_staff_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("message_templates_active_uq").using("btree", table.key.asc().nullsLast().op("text_ops"), table.channel.asc().nullsLast().op("text_ops"), table.locale.asc().nullsLast().op("text_ops")).where(sql`is_active`),
	index("message_templates_locale_idx").using("btree", table.locale.asc().nullsLast().op("text_ops")),
	index("message_templates_staff_idx").using("btree", table.updatedByStaffId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.locale],
			foreignColumns: [languagesInRef.code],
			name: "message_templates_locale_fkey"
		}),
	foreignKey({
			columns: [table.updatedByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "message_templates_updated_by_staff_id_fkey"
		}).onDelete("set null"),
	unique("message_templates_key_channel_locale_version_key").on(table.channel, table.key, table.locale, table.version),
	check("message_templates_channel_check", sql`channel = ANY (ARRAY['email'::text, 'sms'::text, 'whatsapp'::text, 'push'::text, 'in_app'::text])`),
]);

export const announcementsInPlatform = platform.table("announcements", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.announcements_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	title: jsonb().notNull(),
	body: jsonb().notNull(),
	severity: text().default('info').notNull(),
	audience: jsonb().default({}).notNull(),
	placement: text().default('banner').notNull(),
	isDismissible: boolean("is_dismissible").default(true).notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }),
	createdByStaffId: bigint("created_by_staff_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("announcements_live_idx").using("btree", table.startsAt.asc().nullsLast().op("timestamptz_ops"), table.endsAt.asc().nullsLast().op("timestamptz_ops")),
	index("announcements_staff_idx").using("btree", table.createdByStaffId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.createdByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "announcements_created_by_staff_id_fkey"
		}).onDelete("set null"),
	unique("announcements_public_id_key").on(table.publicId),
	check("announcements_body_check", sql`CHECK (util.is_i18n(body`),
	check("announcements_placement_check", sql`placement = ANY (ARRAY['banner'::text, 'modal'::text, 'dashboard_card'::text])`),
	check("announcements_severity_check", sql`severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])`),
	check("announcements_title_check", sql`CHECK (util.is_i18n(title`),
]);

export const statusComponentsInPlatform = platform.table("status_components", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.status_components_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	key: text().notNull(),
	name: jsonb().notNull(),
	status: text().default('operational').notNull(),
	sortOrder: smallint("sort_order").default(0).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("status_components_key_key").on(table.key),
	check("status_components_name_check", sql`CHECK (util.is_i18n(name`),
	check("status_components_status_check", sql`status = ANY (ARRAY['operational'::text, 'degraded'::text, 'partial_outage'::text, 'major_outage'::text, 'maintenance'::text])`),
]);

export const incidentsInPlatform = platform.table("incidents", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.incidents_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	title: jsonb().notNull(),
	impact: text().notNull(),
	status: text().default('investigating').notNull(),
	componentIds: bigint("component_ids", { mode: "bigint" }).array().default([]).notNull(),
	creditsRefundPolicy: jsonb("credits_refund_policy"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	postmortemUrl: text("postmortem_url"),
	createdByStaffId: bigint("created_by_staff_id", { mode: "bigint" }),
}, (table) => [
	index("incidents_open_idx").using("btree", table.startedAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(status <> 'resolved'::text)`),
	index("incidents_staff_idx").using("btree", table.createdByStaffId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.createdByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "incidents_created_by_staff_id_fkey"
		}).onDelete("set null"),
	unique("incidents_public_id_key").on(table.publicId),
	check("incidents_impact_check", sql`impact = ANY (ARRAY['minor'::text, 'major'::text, 'critical'::text])`),
	check("incidents_status_check", sql`status = ANY (ARRAY['investigating'::text, 'identified'::text, 'monitoring'::text, 'resolved'::text])`),
	check("incidents_title_check", sql`CHECK (util.is_i18n(title`),
]);

export const incidentUpdatesInPlatform = platform.table("incident_updates", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.incident_updates_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	incidentId: bigint("incident_id", { mode: "bigint" }).notNull(),
	status: text().notNull(),
	message: jsonb().notNull(),
	staffUserId: bigint("staff_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("incident_updates_incident_idx").using("btree", table.incidentId.asc().nullsLast().op("int8_ops"), table.createdAt.asc().nullsLast().op("int8_ops")),
	index("incident_updates_staff_idx").using("btree", table.staffUserId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.incidentId],
			foreignColumns: [incidentsInPlatform.id],
			name: "incident_updates_incident_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.staffUserId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "incident_updates_staff_user_id_fkey"
		}).onDelete("set null"),
	check("incident_updates_message_check", sql`CHECK (util.is_i18n(message`),
]);

export const apiVersionsInPlatform = platform.table("api_versions", {
	version: text().primaryKey().notNull(),
	status: text().notNull(),
	releasedAt: date("released_at").notNull(),
	deprecatedAt: date("deprecated_at"),
	sunsetAt: date("sunset_at"),
	changelogUrl: text("changelog_url"),
	notes: jsonb(),
}, (table) => [
	check("api_versions_status_check", sql`status = ANY (ARRAY['beta'::text, 'current'::text, 'deprecated'::text, 'sunset'::text])`),
]);

export const maintenanceWindowsInPlatform = platform.table("maintenance_windows", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.maintenance_windows_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	scope: text().notNull(),
	dataRegionId: bigint("data_region_id", { mode: "bigint" }),
	mode: text().default('full').notNull(),
	message: jsonb().notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }).notNull(),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }),
	allowStaff: boolean("allow_staff").default(true).notNull(),
	status: text().default('scheduled').notNull(),
	createdByStaffId: bigint("created_by_staff_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("maintenance_windows_active_idx").using("btree", table.startsAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = ANY (ARRAY['scheduled'::text, 'active'::text]))`),
	index("maintenance_windows_region_idx").using("btree", table.dataRegionId.asc().nullsLast().op("int8_ops")),
	index("maintenance_windows_staff_idx").using("btree", table.createdByStaffId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.createdByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "maintenance_windows_created_by_staff_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.dataRegionId],
			foreignColumns: [dataRegionsInRef.id],
			name: "maintenance_windows_data_region_id_fkey"
		}),
	unique("maintenance_windows_public_id_key").on(table.publicId),
	check("maintenance_windows_message_check", sql`CHECK (util.is_i18n(message`),
	check("maintenance_windows_mode_check", sql`mode = ANY (ARRAY['full'::text, 'read_only'::text, 'degraded'::text])`),
	check("maintenance_windows_scope_check", sql`scope = ANY (ARRAY['global'::text, 'dashboard'::text, 'api'::text, 'mcp_runtime'::text, 'agents'::text, 'payments'::text, 'marketplace'::text])`),
	check("maintenance_windows_status_check", sql`status = ANY (ARRAY['scheduled'::text, 'active'::text, 'completed'::text, 'cancelled'::text])`),
]);

export const rateLimitPoliciesInPlatform = platform.table("rate_limit_policies", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.rate_limit_policies_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	key: text().notNull(),
	scopeType: text("scope_type").notNull(),
	scopeId: bigint("scope_id", { mode: "bigint" }),
	limits: jsonb().notNull(),
	isEnabled: boolean("is_enabled").default(true).notNull(),
	updatedByStaffId: bigint("updated_by_staff_id", { mode: "bigint" }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("rate_limit_policies_staff_idx").using("btree", table.updatedByStaffId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("rate_limit_policies_uq").using("btree", table.key.asc().nullsLast().op("text_ops"), table.scopeType.asc().nullsLast().op("int8_ops"), table.scopeId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.updatedByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "rate_limit_policies_updated_by_staff_id_fkey"
		}).onDelete("set null"),
	check("rate_limit_policies_scope_type_check", sql`scope_type = ANY (ARRAY['global'::text, 'plan'::text, 'organization'::text, 'ip'::text])`),
]);

export const emergencyStopsInPlatform = platform.table("emergency_stops", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.emergency_stops_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	scopeType: text("scope_type").notNull(),
	scopeId: bigint("scope_id", { mode: "bigint" }),
	scopeKey: text("scope_key"),
	reason: text().notNull(),
	blocks: text().array().default(["runs", "tool_calls"]).notNull(),
	activatedByStaffId: bigint("activated_by_staff_id", { mode: "bigint" }),
	activatedAt: timestamp("activated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	deactivatedAt: timestamp("deactivated_at", { withTimezone: true, mode: 'string' }),
	deactivatedByStaffId: bigint("deactivated_by_staff_id", { mode: "bigint" }),
}, (table) => [
	index("emergency_stops_active_idx").using("btree", table.scopeType.asc().nullsLast().op("int8_ops"), table.scopeId.asc().nullsLast().op("int8_ops")).where(sql`(deactivated_at IS NULL)`),
	index("emergency_stops_staff2_idx").using("btree", table.deactivatedByStaffId.asc().nullsLast().op("int8_ops")),
	index("emergency_stops_staff_idx").using("btree", table.activatedByStaffId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.activatedByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "emergency_stops_activated_by_staff_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.deactivatedByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "emergency_stops_deactivated_by_staff_id_fkey"
		}).onDelete("set null"),
	unique("emergency_stops_public_id_key").on(table.publicId),
	check("emergency_stops_scope_type_check", sql`scope_type = ANY (ARRAY['global'::text, 'organization'::text, 'agent'::text, 'model'::text, 'provider'::text, 'deployment'::text, 'mcp_server'::text, 'tool'::text, 'capability'::text, 'feature'::text])`),
]);

export const userSessionsInIam = iam.table("user_sessions", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.user_sessions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	userId: bigint("user_id", { mode: "bigint" }).notNull(),
	// customType: bytea
	tokenHash: bytea("token_hash").notNull(),
	ip: inet(),
	userAgent: text("user_agent"),
	deviceLabel: text("device_label"),
	mfaPassed: boolean("mfa_passed").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("user_sessions_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(revoked_at IS NULL)`),
	index("user_sessions_user_active_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops"), table.lastSeenAt.desc().nullsFirst().op("int8_ops")).where(sql`(revoked_at IS NULL)`),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "user_sessions_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_sessions_public_id_key").on(table.publicId),
	unique("user_sessions_token_hash_key").on(table.tokenHash),
]);

export const oauthClientsInIam = iam.table("oauth_clients", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.oauth_clients_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	clientId: text("client_id").notNull(),
	// customType: bytea
	clientSecretHash: bytea("client_secret_hash"),
	name: text().notNull(),
	logoUri: text("logo_uri"),
	redirectUris: text("redirect_uris").array().notNull(),
	grantTypes: text("grant_types").array().default(["authorization_code", "refresh_token"]).notNull(),
	tokenEndpointAuthMethod: text("token_endpoint_auth_method").default('none').notNull(),
	registeredVia: text("registered_via").default('dcr').notNull(),
	softwareId: text("software_id"),
	isTrusted: boolean("is_trusted").default(false).notNull(),
	status: text().default('active').notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("oauth_clients_software_idx").using("btree", table.softwareId.asc().nullsLast().op("text_ops")),
	unique("oauth_clients_public_id_key").on(table.publicId),
	unique("oauth_clients_client_id_key").on(table.clientId),
	check("oauth_clients_redirect_uris_check", sql`cardinality(redirect_uris) > 0`),
	check("oauth_clients_registered_via_check", sql`registered_via = ANY (ARRAY['dcr'::text, 'manual'::text, 'first_party'::text])`),
	check("oauth_clients_status_check", sql`status = ANY (ARRAY['active'::text, 'blocked'::text])`),
	check("oauth_clients_token_endpoint_auth_method_check", sql`token_endpoint_auth_method = ANY (ARRAY['none'::text, 'client_secret_basic'::text, 'client_secret_post'::text, 'private_key_jwt'::text])`),
]);

export const blocklistEntriesInPlatform = platform.table("blocklist_entries", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.blocklist_entries_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	kind: text().notNull(),
	value: text().notNull(),
	reason: text().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdByStaffId: bigint("created_by_staff_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("blocklist_entries_staff_idx").using("btree", table.createdByStaffId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.createdByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "blocklist_entries_created_by_staff_id_fkey"
		}).onDelete("set null"),
	unique("blocklist_entries_kind_value_key").on(table.kind, table.value),
	check("blocklist_entries_kind_check", sql`kind = ANY (ARRAY['email'::text, 'email_domain'::text, 'phone'::text, 'ip'::text, 'cidr'::text, 'device'::text, 'card_fingerprint'::text])`),
]);

export const usersInIam = iam.table("users", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.users_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	// customType: citext
	email: citext("email"),
	emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: 'string' }),
	phoneE164: text("phone_e164"),
	phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true, mode: 'string' }),
	passwordHash: text("password_hash"),
	fullName: text("full_name"),
	avatarFileId: bigint("avatar_file_id", { mode: "bigint" }),
	locale: text().default('fr').notNull(),
	timezone: text().default('Africa/Douala').notNull(),
	countryCode: char("country_code", { length: 2 }),
	status: text().default('active').notNull(),
	mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("users_avatar_idx").using("btree", table.avatarFileId.asc().nullsLast().op("int8_ops")),
	index("users_country_idx").using("btree", table.countryCode.asc().nullsLast().op("bpchar_ops")),
	index("users_email_trgm").using("gin", sql`((email)::text)`),
	index("users_locale_idx").using("btree", table.locale.asc().nullsLast().op("text_ops")),
	index("users_name_trgm").using("gin", table.fullName.asc().nullsLast().op("gin_trgm_ops")),
	index("users_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")).where(sql`(status <> 'active'::text)`),
	foreignKey({
			columns: [table.avatarFileId],
			foreignColumns: [filesInStorage.id],
			name: "users_avatar_file_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countriesInRef.code],
			name: "users_country_code_fkey"
		}),
	foreignKey({
			columns: [table.locale],
			foreignColumns: [languagesInRef.code],
			name: "users_locale_fkey"
		}),
	unique("users_public_id_key").on(table.publicId),
	unique("users_email_key").on(table.email),
	unique("users_phone_e164_key").on(table.phoneE164),
	check("users_contact_required", sql`(email IS NOT NULL) OR (phone_e164 IS NOT NULL)`),
	check("users_phone_e164_check", sql`phone_e164 ~ '^\+[1-9][0-9]{6,14}$'::text`),
	check("users_phone_requires_verification", sql`(phone_e164 IS NULL) OR (phone_verified_at IS NOT NULL)`),
	check("users_status_check", sql`status = ANY (ARRAY['pending'::text, 'active'::text, 'suspended'::text, 'deleted'::text])`),
]);

export const routingRulesInAi = ai.table("routing_rules", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.routing_rules_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	profileId: bigint("profile_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	priority: smallint().default(100).notNull(),
	conditions: jsonb().default({}).notNull(),
	isEnabled: boolean("is_enabled").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("routing_rules_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("routing_rules_profile_idx").using("btree", table.profileId.asc().nullsLast().op("int8_ops"), table.priority.asc().nullsLast().op("int2_ops")).where(sql`is_enabled`),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "routing_rules_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [routingProfilesInAi.id],
			name: "routing_rules_profile_id_fkey"
		}).onDelete("cascade"),
	unique("routing_rules_public_id_key").on(table.publicId),
]);

export const byokKeysInAi = ai.table("byok_keys", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.byok_keys_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }),
	environmentId: bigint("environment_id", { mode: "bigint" }),
	providerId: bigint("provider_id", { mode: "bigint" }).notNull(),
	label: text().notNull(),
	secretId: bigint("secret_id", { mode: "bigint" }).notNull(),
	priority: smallint().default(100).notNull(),
	status: text().default('active').notNull(),
	lastValidatedAt: timestamp("last_validated_at", { withTimezone: true, mode: 'string' }),
	lastError: text("last_error"),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("byok_keys_creator_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	index("byok_keys_env_idx").using("btree", table.environmentId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")).where(sql`(environment_id IS NOT NULL)`),
	index("byok_keys_lookup_idx").using("btree", table.organizationId.asc().nullsLast().op("int2_ops"), table.providerId.asc().nullsLast().op("int2_ops"), table.priority.asc().nullsLast().op("int8_ops")).where(sql`(status = 'active'::text)`),
	index("byok_keys_provider_idx").using("btree", table.providerId.asc().nullsLast().op("int8_ops")),
	index("byok_keys_secret_idx").using("btree", table.secretId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("byok_keys_ws_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")).where(sql`(workspace_id IS NOT NULL)`),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "byok_keys_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.environmentId],
			foreignColumns: [environmentsInIam.id, environmentsInIam.organizationId],
			name: "byok_keys_environment_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "byok_keys_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [providersInAi.id],
			name: "byok_keys_provider_id_fkey"
		}),
	foreignKey({
			columns: [table.organizationId, table.secretId],
			foreignColumns: [secretsInIam.id, secretsInIam.organizationId],
			name: "byok_keys_secret_id_organization_id_fkey"
		}),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "byok_keys_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("byok_keys_public_id_key").on(table.publicId),
	unique("byok_keys_id_organization_id_key").on(table.id, table.organizationId),
	check("byok_keys_status_check", sql`status = ANY (ARRAY['active'::text, 'invalid'::text, 'revoked'::text])`),
]);

export const capabilitiesInAi = ai.table("capabilities", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.capabilities_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	key: text().notNull(),
	name: text().notNull(),
	description: text(),
	status: text().default('draft').notNull(),
	sourceListingId: bigint("source_listing_id", { mode: "bigint" }),
	visibility: text().default('private').notNull(),
	isSealed: boolean("is_sealed").default(false).notNull(),
	lockVersion: integer("lock_version").default(0).notNull(),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("capabilities_creator_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("capabilities_key_uq").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.key.asc().nullsLast().op("text_ops")).where(sql`(deleted_at IS NULL)`),
	index("capabilities_listing_idx").using("btree", table.sourceListingId.asc().nullsLast().op("int8_ops")),
	index("capabilities_org_shared_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops"), table.key.asc().nullsLast().op("int8_ops")).where(sql`((visibility <> 'private'::text) AND (deleted_at IS NULL))`),
	index("capabilities_ws_org_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "capabilities_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.sourceListingId],
			foreignColumns: [listingsInMarket.id],
			name: "capabilities_listing_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "capabilities_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("capabilities_public_id_key").on(table.publicId),
	unique("capabilities_id_organization_id_key").on(table.id, table.organizationId),
	check("capabilities_key_check", sql`key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'::text`),
	check("capabilities_status_check", sql`status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text])`),
	check("capabilities_visibility_check", sql`visibility = ANY (ARRAY['private'::text, 'organization'::text, 'public'::text])`),
]);

export const rolesInIam = iam.table("roles", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.roles_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	key: text().notNull(),
	name: jsonb().notNull(),
	description: jsonb(),
	isSystem: boolean("is_system").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("roles_key_uq").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.key.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "roles_organization_id_fkey"
		}).onDelete("cascade"),
	unique("roles_public_id_key").on(table.publicId),
	check("roles_check", sql`is_system = (organization_id IS NULL)`),
	check("roles_key_check", sql`key ~ '^[a-z0-9_]+$'::text`),
	check("roles_name_check", sql`CHECK (util.is_i18n(name`),
]);

export const membershipsInIam = iam.table("memberships", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.memberships_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	userId: bigint("user_id", { mode: "bigint" }).notNull(),
	roleId: bigint("role_id", { mode: "bigint" }).notNull(),
	status: text().default('active').notNull(),
	invitedByUserId: bigint("invited_by_user_id", { mode: "bigint" }),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("memberships_invited_idx").using("btree", table.invitedByUserId.asc().nullsLast().op("int8_ops")),
	index("memberships_role_idx").using("btree", table.roleId.asc().nullsLast().op("int8_ops")),
	index("memberships_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.invitedByUserId],
			foreignColumns: [usersInIam.id],
			name: "memberships_invited_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "memberships_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [rolesInIam.id],
			name: "memberships_role_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "memberships_user_id_fkey"
		}).onDelete("cascade"),
	unique("memberships_public_id_key").on(table.publicId),
	unique("memberships_organization_id_user_id_key").on(table.organizationId, table.userId),
	unique("memberships_id_organization_id_key").on(table.id, table.organizationId),
	check("memberships_status_check", sql`status = ANY (ARRAY['active'::text, 'suspended'::text])`),
]);

export const invitationsInIam = iam.table("invitations", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.invitations_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	// customType: citext
	email: citext("email").notNull(),
	roleId: bigint("role_id", { mode: "bigint" }).notNull(),
	// customType: bytea
	tokenHash: bytea("token_hash").notNull(),
	invitedByUserId: bigint("invited_by_user_id", { mode: "bigint" }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("invitations_email_idx").using("btree", table.email.asc().nullsLast().op("citext_ops")),
	index("invitations_invited_idx").using("btree", table.invitedByUserId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("invitations_pending_uq").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.email.asc().nullsLast().op("int8_ops")).where(sql`((accepted_at IS NULL) AND (revoked_at IS NULL))`),
	index("invitations_role_idx").using("btree", table.roleId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.invitedByUserId],
			foreignColumns: [usersInIam.id],
			name: "invitations_invited_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "invitations_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [rolesInIam.id],
			name: "invitations_role_id_fkey"
		}),
	unique("invitations_public_id_key").on(table.publicId),
	unique("invitations_token_hash_key").on(table.tokenHash),
]);

export const teamsInIam = iam.table("teams", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.teams_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	name: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("teams_name_uq").using("btree", sql`organization_id`, sql`lower(name)`).where(sql`(deleted_at IS NULL)`),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "teams_organization_id_fkey"
		}).onDelete("cascade"),
	unique("teams_public_id_key").on(table.publicId),
	unique("teams_id_organization_id_key").on(table.id, table.organizationId),
]);

export const workspacesInIam = iam.table("workspaces", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.workspaces_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	name: text().notNull(),
	// customType: citext
	slug: citext("slug").notNull(),
	description: text(),
	dataRegionId: bigint("data_region_id", { mode: "bigint" }),
	status: text().default('active').notNull(),
	settings: jsonb().default({}).notNull(),
	lockVersion: integer("lock_version").default(0).notNull(),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	defaultRoutingProfileId: bigint("default_routing_profile_id", { mode: "bigint" }),
}, (table) => [
	index("workspaces_created_by_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	index("workspaces_region_idx").using("btree", table.dataRegionId.asc().nullsLast().op("int8_ops")),
	index("workspaces_routing_profile_idx").using("btree", table.defaultRoutingProfileId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("workspaces_slug_uq").using("btree", table.organizationId.asc().nullsLast().op("citext_ops"), table.slug.asc().nullsLast().op("citext_ops")).where(sql`(deleted_at IS NULL)`),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "workspaces_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.dataRegionId],
			foreignColumns: [dataRegionsInRef.id],
			name: "workspaces_data_region_id_fkey"
		}),
	foreignKey({
			columns: [table.defaultRoutingProfileId],
			foreignColumns: [routingProfilesInAi.id],
			name: "workspaces_default_routing_profile_id_fkey"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "workspaces_organization_id_fkey"
		}).onDelete("cascade"),
	unique("workspaces_public_id_key").on(table.publicId),
	unique("workspaces_id_organization_id_key").on(table.id, table.organizationId),
	check("workspaces_slug_check", sql`slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'::citext`),
	check("workspaces_status_check", sql`status = ANY (ARRAY['active'::text, 'suspended'::text, 'archived'::text])`),
]);

export const environmentsInIam = iam.table("environments", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.environments_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	key: text().notNull(),
	name: text().notNull(),
	kind: text().default('custom').notNull(),
	isSandbox: boolean("is_sandbox").default(false).notNull(),
	settings: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("environments_key_uq").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.key.asc().nullsLast().op("int8_ops")).where(sql`(deleted_at IS NULL)`),
	index("environments_ws_org_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "environments_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("environments_public_id_key").on(table.publicId),
	unique("environments_id_organization_id_key").on(table.id, table.organizationId),
	unique("environments_id_workspace_id_key").on(table.id, table.workspaceId),
	check("environments_key_check", sql`key ~ '^[a-z0-9_-]{1,32}$'::text`),
	check("environments_kind_check", sql`kind = ANY (ARRAY['development'::text, 'staging'::text, 'production'::text, 'sandbox'::text, 'custom'::text])`),
]);

export const projectsInIam = iam.table("projects", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.projects_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	name: text().notNull(),
	// customType: citext
	slug: citext("slug").notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("projects_slug_uq").using("btree", table.workspaceId.asc().nullsLast().op("citext_ops"), table.slug.asc().nullsLast().op("int8_ops")).where(sql`(deleted_at IS NULL)`),
	index("projects_ws_org_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "projects_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("projects_public_id_key").on(table.publicId),
	unique("projects_id_organization_id_key").on(table.id, table.organizationId),
	check("projects_slug_check", sql`slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'::citext`),
]);

export const filesInStorage = storage.table("files", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "storage.files_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	workspaceId: bigint("workspace_id", { mode: "bigint" }),
	purpose: text().notNull(),
	backendId: bigint("backend_id", { mode: "bigint" }).notNull(),
	bucket: text().notNull(),
	storageKey: text("storage_key").notNull(),
	filename: text().notNull(),
	mimeType: text("mime_type").notNull(),
	sizeBytes: bigint("size_bytes", { mode: "bigint" }).notNull(),
	// customType: bytea
	checksumSha256: bytea("checksum_sha256"),
	dataRegionId: bigint("data_region_id", { mode: "bigint" }).notNull(),
	scanStatus: text("scan_status").default('pending').notNull(),
	uploadedByUserId: bigint("uploaded_by_user_id", { mode: "bigint" }),
	metadata: jsonb().default({}).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("files_backend_idx").using("btree", table.backendId.asc().nullsLast().op("int8_ops"), table.id.asc().nullsLast().op("int8_ops")),
	index("files_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`((expires_at IS NOT NULL) AND (deleted_at IS NULL))`),
	index("files_org_purpose_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops"), table.purpose.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("int8_ops")),
	index("files_region_idx").using("btree", table.dataRegionId.asc().nullsLast().op("int8_ops")),
	index("files_scan_idx").using("btree", table.scanStatus.asc().nullsLast().op("text_ops")).where(sql`(scan_status = ANY (ARRAY['pending'::text, 'infected'::text]))`),
	index("files_uploader_idx").using("btree", table.uploadedByUserId.asc().nullsLast().op("int8_ops")),
	index("files_ws_org_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")).where(sql`(workspace_id IS NOT NULL)`),
	foreignKey({
			columns: [table.backendId],
			foreignColumns: [backendsInStorage.id],
			name: "files_backend_id_fkey"
		}),
	foreignKey({
			columns: [table.dataRegionId],
			foreignColumns: [dataRegionsInRef.id],
			name: "files_data_region_id_fkey"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "files_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.uploadedByUserId],
			foreignColumns: [usersInIam.id],
			name: "files_uploaded_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "files_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("files_public_id_key").on(table.publicId),
	unique("files_backend_id_bucket_storage_key_key").on(table.backendId, table.bucket, table.storageKey),
	unique("files_id_organization_id_key").on(table.id, table.organizationId),
	check("files_purpose_check", sql`purpose = ANY (ARRAY['avatar'::text, 'connector_source'::text, 'data_file'::text, 'chat_attachment'::text, 'agent_artifact'::text, 'invoice_pdf'::text, 'export'::text, 'marketplace_asset'::text, 'legal_document'::text, 'support_attachment'::text, 'eval_dataset'::text, 'other'::text])`),
	check("files_scan_status_check", sql`scan_status = ANY (ARRAY['pending'::text, 'clean'::text, 'infected'::text, 'skipped'::text, 'failed'::text])`),
	check("files_size_bytes_check", sql`size_bytes >= 0`),
]);

export const subscriptionsInBilling = billing.table("subscriptions", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.subscriptions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	planId: bigint("plan_id", { mode: "bigint" }).notNull(),
	planPriceId: bigint("plan_price_id", { mode: "bigint" }),
	status: text().notNull(),
	currency: char({ length: 3 }).notNull(),
	llmCoefficientOverride: numeric("llm_coefficient_override", { precision: 6, scale:  4 }),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: 'string' }).notNull(),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'string' }).notNull(),
	trialEndsAt: timestamp("trial_ends_at", { withTimezone: true, mode: 'string' }),
	graceEndsAt: timestamp("grace_ends_at", { withTimezone: true, mode: 'string' }),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
	cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: 'string' }),
	endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
	defaultPaymentMethodId: bigint("default_payment_method_id", { mode: "bigint" }),
	autoRenew: boolean("auto_renew").default(true).notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("subscriptions_currency_idx").using("btree", table.currency.asc().nullsLast().op("bpchar_ops")),
	uniqueIndex("subscriptions_one_live_uq").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")).where(sql`(status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'grace'::text]))`),
	index("subscriptions_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("subscriptions_plan_idx").using("btree", table.planId.asc().nullsLast().op("int8_ops")),
	index("subscriptions_pm_idx").using("btree", table.defaultPaymentMethodId.asc().nullsLast().op("int8_ops")),
	index("subscriptions_price_idx").using("btree", table.planPriceId.asc().nullsLast().op("int8_ops")),
	index("subscriptions_renewal_idx").using("btree", table.currentPeriodEnd.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = ANY (ARRAY['active'::text, 'past_due'::text, 'grace'::text]))`),
	foreignKey({
			columns: [table.currency],
			foreignColumns: [currenciesInRef.code],
			name: "subscriptions_currency_fkey"
		}),
	foreignKey({
			columns: [table.defaultPaymentMethodId],
			foreignColumns: [paymentMethodsInBilling.id],
			name: "subscriptions_default_pm_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "subscriptions_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [plansInBilling.id],
			name: "subscriptions_plan_id_fkey"
		}),
	foreignKey({
			columns: [table.planPriceId],
			foreignColumns: [planPricesInBilling.id],
			name: "subscriptions_plan_price_id_fkey"
		}),
	unique("subscriptions_public_id_key").on(table.publicId),
	check("subscriptions_check", sql`current_period_end > current_period_start`),
	check("subscriptions_llm_coefficient_override_check", sql`llm_coefficient_override >= (1)::numeric`),
	check("subscriptions_status_check", sql`status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'grace'::text, 'cancelled'::text, 'expired'::text])`),
]);

export const subscriptionEventsInBilling = billing.table("subscription_events", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.subscription_events_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	subscriptionId: bigint("subscription_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	eventType: text("event_type").notNull(),
	fromPlanId: bigint("from_plan_id", { mode: "bigint" }),
	toPlanId: bigint("to_plan_id", { mode: "bigint" }),
	prorationMinor: bigint("proration_minor", { mode: "bigint" }),
	effectiveAt: timestamp("effective_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	actor: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("subscription_events_from_idx").using("btree", table.fromPlanId.asc().nullsLast().op("int8_ops")),
	index("subscription_events_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("subscription_events_sub_idx").using("btree", table.subscriptionId.asc().nullsLast().op("timestamptz_ops"), table.effectiveAt.desc().nullsFirst().op("timestamptz_ops")),
	index("subscription_events_to_idx").using("btree", table.toPlanId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.fromPlanId],
			foreignColumns: [plansInBilling.id],
			name: "subscription_events_from_plan_id_fkey"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "subscription_events_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptionsInBilling.id],
			name: "subscription_events_subscription_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.toPlanId],
			foreignColumns: [plansInBilling.id],
			name: "subscription_events_to_plan_id_fkey"
		}),
	check("subscription_events_event_type_check", sql`event_type = ANY (ARRAY['created'::text, 'upgraded'::text, 'downgraded'::text, 'renewed'::text, 'payment_failed'::text, 'grace_started'::text, 'cancelled'::text, 'reactivated'::text, 'expired'::text, 'plan_price_changed'::text])`),
]);

export const creditWalletsInBilling = billing.table("credit_wallets", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.credit_wallets_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }),
	kind: text().notNull(),
	balanceMicro: bigint("balance_micro", { mode: "bigint" }).default(0).notNull(),
	reservedMicro: bigint("reserved_micro", { mode: "bigint" }).default(0).notNull(),
	overdraftLimitMicro: bigint("overdraft_limit_micro", { mode: "bigint" }).default(0).notNull(),
	lowBalanceThresholdMicro: bigint("low_balance_threshold_micro", { mode: "bigint" }),
	lockVersion: integer("lock_version").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("credit_wallets_owner_uq").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.workspaceId.asc().nullsLast().op("text_ops"), table.kind.asc().nullsLast().op("int8_ops")),
	index("credit_wallets_ws_org_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")).where(sql`(workspace_id IS NOT NULL)`),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "credit_wallets_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "credit_wallets_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("credit_wallets_public_id_key").on(table.publicId),
	unique("credit_wallets_id_organization_id_key").on(table.id, table.organizationId),
	check("credit_wallets_check", sql`balance_micro >= (- overdraft_limit_micro)`),
	check("credit_wallets_kind_check", sql`kind = ANY (ARRAY['llm'::text, 'infra'::text, 'test'::text])`),
	check("credit_wallets_overdraft_limit_micro_check", sql`overdraft_limit_micro >= 0`),
	check("credit_wallets_reserved_micro_check", sql`reserved_micro >= 0`),
]);

export const creditGrantsInBilling = billing.table("credit_grants", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.credit_grants_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	walletId: bigint("wallet_id", { mode: "bigint" }).notNull(),
	source: text().notNull(),
	amountMicro: bigint("amount_micro", { mode: "bigint" }).notNull(),
	remainingMicro: bigint("remaining_micro", { mode: "bigint" }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	sourceRefType: text("source_ref_type"),
	sourceRefId: bigint("source_ref_id", { mode: "bigint" }),
	periodStart: timestamp("period_start", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("credit_grants_consumable_idx").using("btree", table.walletId.asc().nullsLast().op("int8_ops"), table.expiresAt.asc().nullsLast().op("timestamptz_ops"), table.id.asc().nullsLast().op("int8_ops")).where(sql`(remaining_micro > 0)`),
	index("credit_grants_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`((remaining_micro > 0) AND (expires_at IS NOT NULL))`),
	index("credit_grants_source_ref_idx").using("btree", table.sourceRefType.asc().nullsLast().op("int8_ops"), table.sourceRefId.asc().nullsLast().op("text_ops")),
	index("credit_grants_wallet_org_idx").using("btree", table.walletId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId, table.walletId],
			foreignColumns: [creditWalletsInBilling.id, creditWalletsInBilling.organizationId],
			name: "credit_grants_wallet_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("credit_grants_public_id_key").on(table.publicId),
	unique("credit_grants_id_organization_id_key").on(table.id, table.organizationId),
	check("credit_grants_amount_micro_check", sql`amount_micro > 0`),
	check("credit_grants_check", sql`remaining_micro <= amount_micro`),
	check("credit_grants_remaining_micro_check", sql`remaining_micro >= 0`),
	check("credit_grants_source_check", sql`source = ANY (ARRAY['plan_included'::text, 'purchase'::text, 'bonus'::text, 'referral'::text, 'promo'::text, 'refund'::text, 'goodwill'::text, 'migration'::text])`),
]);

export const creditReservationsInBilling = billing.table("credit_reservations", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.credit_reservations_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	walletId: bigint("wallet_id", { mode: "bigint" }).notNull(),
	runId: bigint("run_id", { mode: "bigint" }).notNull(),
	runCreatedAt: timestamp("run_created_at", { withTimezone: true, mode: 'string' }).notNull(),
	amountMicro: bigint("amount_micro", { mode: "bigint" }).notNull(),
	status: text().default('held').notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	settledAt: timestamp("settled_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("credit_reservations_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = 'held'::text)`),
	index("credit_reservations_held_idx").using("btree", table.walletId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")).where(sql`(status = 'held'::text)`),
	uniqueIndex("credit_reservations_run_uq").using("btree", table.runId.asc().nullsLast().op("int8_ops"), table.walletId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId, table.walletId],
			foreignColumns: [creditWalletsInBilling.id, creditWalletsInBilling.organizationId],
			name: "credit_reservations_wallet_id_organization_id_fkey"
		}).onDelete("cascade"),
	check("credit_reservations_amount_micro_check", sql`amount_micro > 0`),
	check("credit_reservations_status_check", sql`status = ANY (ARRAY['held'::text, 'settled'::text, 'released'::text, 'expired'::text])`),
]);

export const paymentMethodsInBilling = billing.table("payment_methods", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.payment_methods_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	providerId: bigint("provider_id", { mode: "bigint" }).notNull(),
	kind: text().notNull(),
	operator: text(),
	displayLabel: text("display_label").notNull(),
	phoneE164: text("phone_e164"),
	countryCode: char("country_code", { length: 2 }),
	externalRef: text("external_ref"),
	isDefault: boolean("is_default").default(false).notNull(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("payment_methods_country_idx").using("btree", table.countryCode.asc().nullsLast().op("bpchar_ops")),
	uniqueIndex("payment_methods_default_uq").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")).where(sql`(is_default AND (status = 'active'::text))`),
	index("payment_methods_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("payment_methods_provider_idx").using("btree", table.providerId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countriesInRef.code],
			name: "payment_methods_country_code_fkey"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "payment_methods_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [paymentProvidersInBilling.id],
			name: "payment_methods_provider_id_fkey"
		}),
	unique("payment_methods_public_id_key").on(table.publicId),
	check("payment_methods_kind_check", sql`kind = ANY (ARRAY['mobile_money'::text, 'card'::text, 'bank_transfer'::text])`),
	check("payment_methods_status_check", sql`status = ANY (ARRAY['active'::text, 'expired'::text, 'removed'::text])`),
]);

export const invoicesInBilling = billing.table("invoices", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.invoices_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	number: text(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	subscriptionId: bigint("subscription_id", { mode: "bigint" }),
	kind: text().default('invoice').notNull(),
	correctsInvoiceId: bigint("corrects_invoice_id", { mode: "bigint" }),
	status: text().default('draft').notNull(),
	currency: char({ length: 3 }).notNull(),
	subtotalMinor: bigint("subtotal_minor", { mode: "bigint" }).default(0).notNull(),
	discountMinor: bigint("discount_minor", { mode: "bigint" }).default(0).notNull(),
	taxMinor: bigint("tax_minor", { mode: "bigint" }).default(0).notNull(),
	totalMinor: bigint("total_minor", { mode: "bigint" }).default(0).notNull(),
	amountPaidMinor: bigint("amount_paid_minor", { mode: "bigint" }).default(0).notNull(),
	billingSnapshot: jsonb("billing_snapshot").default({}).notNull(),
	pdfFileId: bigint("pdf_file_id", { mode: "bigint" }),
	issuedAt: timestamp("issued_at", { withTimezone: true, mode: 'string' }),
	dueAt: timestamp("due_at", { withTimezone: true, mode: 'string' }),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	voidedAt: timestamp("voided_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("invoices_corrects_idx").using("btree", table.correctsInvoiceId.asc().nullsLast().op("int8_ops")),
	index("invoices_currency_idx").using("btree", table.currency.asc().nullsLast().op("bpchar_ops")),
	index("invoices_open_due_idx").using("btree", table.dueAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = 'open'::text)`),
	index("invoices_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("invoices_pdf_idx").using("btree", table.pdfFileId.asc().nullsLast().op("int8_ops")),
	index("invoices_sub_idx").using("btree", table.subscriptionId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.correctsInvoiceId],
			foreignColumns: [table.id],
			name: "invoices_corrects_invoice_id_fkey"
		}),
	foreignKey({
			columns: [table.currency],
			foreignColumns: [currenciesInRef.code],
			name: "invoices_currency_fkey"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "invoices_organization_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.pdfFileId],
			foreignColumns: [filesInStorage.id],
			name: "invoices_pdf_file_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptionsInBilling.id],
			name: "invoices_subscription_id_fkey"
		}).onDelete("set null"),
	unique("invoices_public_id_key").on(table.publicId),
	unique("invoices_number_key").on(table.number),
	check("invoices_check", sql`total_minor = ((subtotal_minor - discount_minor) + tax_minor)`),
	check("invoices_kind_check", sql`kind = ANY (ARRAY['invoice'::text, 'credit_note'::text])`),
	check("invoices_status_check", sql`status = ANY (ARRAY['draft'::text, 'open'::text, 'paid'::text, 'void'::text, 'uncollectible'::text])`),
]);

export const invoiceLinesInBilling = billing.table("invoice_lines", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.invoice_lines_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	invoiceId: bigint("invoice_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	lineType: text("line_type").notNull(),
	description: jsonb().notNull(),
	quantity: numeric({ precision: 18, scale:  6 }).default('1').notNull(),
	unitAmountMinor: bigint("unit_amount_minor", { mode: "bigint" }).notNull(),
	amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
	taxRateId: bigint("tax_rate_id", { mode: "bigint" }),
	taxMinor: bigint("tax_minor", { mode: "bigint" }).default(0).notNull(),
	referenceType: text("reference_type"),
	referenceId: bigint("reference_id", { mode: "bigint" }),
	periodStart: timestamp("period_start", { withTimezone: true, mode: 'string' }),
	periodEnd: timestamp("period_end", { withTimezone: true, mode: 'string' }),
	position: smallint().default(0).notNull(),
}, (table) => [
	index("invoice_lines_invoice_idx").using("btree", table.invoiceId.asc().nullsLast().op("int8_ops"), table.position.asc().nullsLast().op("int2_ops")),
	index("invoice_lines_ref_idx").using("btree", table.referenceType.asc().nullsLast().op("int8_ops"), table.referenceId.asc().nullsLast().op("text_ops")),
	index("invoice_lines_tax_idx").using("btree", table.taxRateId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoicesInBilling.id],
			name: "invoice_lines_invoice_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.taxRateId],
			foreignColumns: [taxRatesInRef.id],
			name: "invoice_lines_tax_rate_id_fkey"
		}),
	check("invoice_lines_description_check", sql`CHECK (util.is_i18n(description`),
	check("invoice_lines_line_type_check", sql`line_type = ANY (ARRAY['subscription'::text, 'credit_pack'::text, 'overage'::text, 'marketplace'::text, 'adjustment'::text, 'discount'::text])`),
]);

export const paymentsInBilling = billing.table("payments", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.payments_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	invoiceId: bigint("invoice_id", { mode: "bigint" }),
	providerId: bigint("provider_id", { mode: "bigint" }).notNull(),
	paymentMethodId: bigint("payment_method_id", { mode: "bigint" }),
	purpose: text().notNull(),
	status: text().default('pending').notNull(),
	currency: char({ length: 3 }).notNull(),
	amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
	feeMinor: bigint("fee_minor", { mode: "bigint" }).default(0).notNull(),
	netMinor: bigint("net_minor", { mode: "bigint" }),
	idempotencyKey: text("idempotency_key").notNull(),
	externalTransactionId: text("external_transaction_id"),
	externalStatus: text("external_status"),
	failureCode: text("failure_code"),
	failureMessage: text("failure_message"),
	initiatedByUserId: bigint("initiated_by_user_id", { mode: "bigint" }),
	initiatedAt: timestamp("initiated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	settledAt: timestamp("settled_at", { withTimezone: true, mode: 'string' }),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("payments_currency_idx").using("btree", table.currency.asc().nullsLast().op("bpchar_ops")),
	uniqueIndex("payments_external_uq").using("btree", table.providerId.asc().nullsLast().op("int8_ops"), table.externalTransactionId.asc().nullsLast().op("text_ops")).where(sql`(external_transaction_id IS NOT NULL)`),
	index("payments_initiator_idx").using("btree", table.initiatedByUserId.asc().nullsLast().op("int8_ops")),
	index("payments_invoice_idx").using("btree", table.invoiceId.asc().nullsLast().op("int8_ops")),
	index("payments_method_idx").using("btree", table.paymentMethodId.asc().nullsLast().op("int8_ops")),
	index("payments_org_idx").using("btree", table.organizationId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("int8_ops")),
	index("payments_pending_idx").using("btree", table.providerId.asc().nullsLast().op("timestamptz_ops"), table.initiatedAt.asc().nullsLast().op("int8_ops")).where(sql`(status = ANY (ARRAY['pending'::text, 'processing'::text]))`),
	index("payments_unsettled_idx").using("btree", table.providerId.asc().nullsLast().op("int8_ops"), table.completedAt.asc().nullsLast().op("int8_ops")).where(sql`((status = 'succeeded'::text) AND (settled_at IS NULL))`),
	foreignKey({
			columns: [table.currency],
			foreignColumns: [currenciesInRef.code],
			name: "payments_currency_fkey"
		}),
	foreignKey({
			columns: [table.initiatedByUserId],
			foreignColumns: [usersInIam.id],
			name: "payments_initiated_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoicesInBilling.id],
			name: "payments_invoice_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "payments_organization_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.paymentMethodId],
			foreignColumns: [paymentMethodsInBilling.id],
			name: "payments_payment_method_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [paymentProvidersInBilling.id],
			name: "payments_provider_id_fkey"
		}),
	unique("payments_public_id_key").on(table.publicId),
	unique("payments_idempotency_key_key").on(table.idempotencyKey),
	check("payments_amount_minor_check", sql`amount_minor > 0`),
	check("payments_purpose_check", sql`purpose = ANY (ARRAY['subscription'::text, 'credit_pack'::text, 'marketplace'::text, 'invoice'::text, 'other'::text])`),
	check("payments_status_check", sql`status = ANY (ARRAY['pending'::text, 'processing'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text, 'expired'::text, 'refunded'::text, 'partially_refunded'::text])`),
]);

export const refundsInBilling = billing.table("refunds", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.refunds_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	paymentId: bigint("payment_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
	reason: text().notNull(),
	status: text().default('pending').notNull(),
	externalRef: text("external_ref"),
	requestedBy: jsonb("requested_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("refunds_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("refunds_payment_idx").using("btree", table.paymentId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "refunds_organization_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.paymentId],
			foreignColumns: [paymentsInBilling.id],
			name: "refunds_payment_id_fkey"
		}),
	unique("refunds_public_id_key").on(table.publicId),
	check("refunds_amount_minor_check", sql`amount_minor > 0`),
	check("refunds_status_check", sql`status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text])`),
]);

export const budgetsInBilling = billing.table("budgets", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.budgets_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	name: text().notNull(),
	scopeType: text("scope_type").notNull(),
	scopeId: bigint("scope_id", { mode: "bigint" }).notNull(),
	creditKind: text("credit_kind").default('all').notNull(),
	period: text().default('monthly').notNull(),
	customStart: timestamp("custom_start", { withTimezone: true, mode: 'string' }),
	customEnd: timestamp("custom_end", { withTimezone: true, mode: 'string' }),
	amountMicro: bigint("amount_micro", { mode: "bigint" }).notNull(),
	alertThresholds: smallint("alert_thresholds").array().default([70, 90]).notNull(),
	actionOnExceed: text("action_on_exceed").default('block_new_runs').notNull(),
	isEnabled: boolean("is_enabled").default(true).notNull(),
	lockVersion: integer("lock_version").default(0).notNull(),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("budgets_created_by_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	index("budgets_scope_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.scopeType.asc().nullsLast().op("text_ops"), table.scopeId.asc().nullsLast().op("text_ops")).where(sql`is_enabled`),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "budgets_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "budgets_organization_id_fkey"
		}).onDelete("cascade"),
	unique("budgets_public_id_key").on(table.publicId),
	check("budgets_action_on_exceed_check", sql`action_on_exceed = ANY (ARRAY['alert_only'::text, 'block_new_runs'::text, 'block_all'::text])`),
	check("budgets_amount_micro_check", sql`amount_micro > 0`),
	check("budgets_check", sql`(period <> 'custom'::text) OR ((custom_start IS NOT NULL) AND (custom_end > custom_start))`),
	check("budgets_credit_kind_check", sql`credit_kind = ANY (ARRAY['llm'::text, 'infra'::text, 'all'::text])`),
	check("budgets_period_check", sql`period = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'custom'::text])`),
	check("budgets_scope_type_check", sql`scope_type = ANY (ARRAY['organization'::text, 'workspace'::text, 'environment'::text, 'project'::text, 'team'::text, 'agent'::text, 'api_key'::text, 'end_user'::text])`),
]);

export const budgetPeriodsInBilling = billing.table("budget_periods", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.budget_periods_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	budgetId: bigint("budget_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	periodStart: timestamp("period_start", { withTimezone: true, mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { withTimezone: true, mode: 'string' }).notNull(),
	consumedMicro: bigint("consumed_micro", { mode: "bigint" }).default(0).notNull(),
	alertsSent: smallint("alerts_sent").array().default([]).notNull(),
	exceededAt: timestamp("exceeded_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("budget_periods_org_idx").using("btree", table.organizationId.asc().nullsLast().op("timestamptz_ops"), table.periodStart.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.budgetId],
			foreignColumns: [budgetsInBilling.id],
			name: "budget_periods_budget_id_fkey"
		}).onDelete("cascade"),
	unique("budget_periods_budget_id_period_start_key").on(table.budgetId, table.periodStart),
]);

export const couponRedemptionsInBilling = billing.table("coupon_redemptions", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "billing.coupon_redemptions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	couponId: bigint("coupon_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	userId: bigint("user_id", { mode: "bigint" }),
	invoiceId: bigint("invoice_id", { mode: "bigint" }),
	creditGrantId: bigint("credit_grant_id", { mode: "bigint" }),
	redeemedAt: timestamp("redeemed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("coupon_redemptions_coupon_idx").using("btree", table.couponId.asc().nullsLast().op("int8_ops")),
	index("coupon_redemptions_grant_idx").using("btree", table.creditGrantId.asc().nullsLast().op("int8_ops")),
	index("coupon_redemptions_invoice_idx").using("btree", table.invoiceId.asc().nullsLast().op("int8_ops")),
	index("coupon_redemptions_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.couponId.asc().nullsLast().op("int8_ops")),
	index("coupon_redemptions_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.couponId],
			foreignColumns: [couponsInBilling.id],
			name: "coupon_redemptions_coupon_id_fkey"
		}),
	foreignKey({
			columns: [table.creditGrantId],
			foreignColumns: [creditGrantsInBilling.id],
			name: "coupon_redemptions_credit_grant_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoicesInBilling.id],
			name: "coupon_redemptions_invoice_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "coupon_redemptions_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "coupon_redemptions_user_id_fkey"
		}).onDelete("set null"),
]);

export const secretsInIam = iam.table("secrets", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.secrets_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	workspaceId: bigint("workspace_id", { mode: "bigint" }),
	environmentId: bigint("environment_id", { mode: "bigint" }),
	ownerType: text("owner_type").notNull(),
	vaultPath: text("vault_path").notNull(),
	vaultVersion: integer("vault_version").default(1).notNull(),
	fingerprint: text(),
	status: text().default('active').notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true, mode: 'string' }),
	lastValidatedAt: timestamp("last_validated_at", { withTimezone: true, mode: 'string' }),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("secrets_creator_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	index("secrets_env_org_idx").using("btree", table.environmentId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")).where(sql`(environment_id IS NOT NULL)`),
	index("secrets_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`((status = 'active'::text) AND (expires_at IS NOT NULL))`),
	index("secrets_org_owner_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.ownerType.asc().nullsLast().op("int8_ops")),
	index("secrets_ws_org_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")).where(sql`(workspace_id IS NOT NULL)`),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "secrets_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.environmentId],
			foreignColumns: [environmentsInIam.id, environmentsInIam.organizationId],
			name: "secrets_environment_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "secrets_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "secrets_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("secrets_public_id_key").on(table.publicId),
	unique("secrets_vault_path_key").on(table.vaultPath),
	unique("secrets_id_organization_id_key").on(table.id, table.organizationId),
	check("secrets_owner_type_check", sql`owner_type = ANY (ARRAY['connector_credential'::text, 'byok_key'::text, 'webhook_signing'::text, 'provider_account'::text, 'payment_provider'::text, 'oauth_token'::text, 'bridge'::text, 'service_account'::text, 'mcp_upstream'::text, 'other'::text])`),
	check("secrets_status_check", sql`status = ANY (ARRAY['active'::text, 'rotating'::text, 'revoked'::text, 'expired'::text])`),
]);

export const routingProfilesInAi = ai.table("routing_profiles", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.routing_profiles_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	key: text().notNull(),
	name: jsonb().notNull(),
	description: jsonb(),
	strategy: jsonb().default({}).notNull(),
	isSystem: boolean("is_system").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("routing_profiles_key_uq").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.key.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "routing_profiles_organization_id_fkey"
		}).onDelete("cascade"),
	unique("routing_profiles_public_id_key").on(table.publicId),
	check("routing_profiles_check", sql`is_system = (organization_id IS NULL)`),
	check("routing_profiles_key_check", sql`key ~ '^[a-z0-9_]+$'::text`),
	check("routing_profiles_name_check", sql`CHECK (util.is_i18n(name`),
]);

export const capabilityVersionsInAi = ai.table("capability_versions", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.capability_versions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	capabilityId: bigint("capability_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	version: integer().notNull(),
	systemPrompt: text("system_prompt").notNull(),
	userTemplate: text("user_template"),
	variablesSchema: jsonb("variables_schema").default({}).notNull(),
	inputSchema: jsonb("input_schema"),
	outputSchema: jsonb("output_schema"),
	routingProfileId: bigint("routing_profile_id", { mode: "bigint" }),
	modelOverrideId: bigint("model_override_id", { mode: "bigint" }),
	modelFallback: text("model_fallback").default('profile').notNull(),
	params: jsonb().default({}).notNull(),
	toolRefs: jsonb("tool_refs").default([]).notNull(),
	optimization: jsonb().default({}).notNull(),
	guardrails: jsonb().default({}).notNull(),
	changelog: text(),
	isLocked: boolean("is_locked").default(false).notNull(),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("capability_versions_cap_org_idx").using("btree", table.capabilityId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("capability_versions_creator_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	index("capability_versions_model_idx").using("btree", table.modelOverrideId.asc().nullsLast().op("int8_ops")),
	index("capability_versions_profile_idx").using("btree", table.routingProfileId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.capabilityId, table.organizationId],
			foreignColumns: [capabilitiesInAi.id, capabilitiesInAi.organizationId],
			name: "capability_versions_capability_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "capability_versions_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.modelOverrideId],
			foreignColumns: [modelsInAi.id],
			name: "capability_versions_model_override_id_fkey"
		}),
	foreignKey({
			columns: [table.routingProfileId],
			foreignColumns: [routingProfilesInAi.id],
			name: "capability_versions_routing_profile_id_fkey"
		}),
	unique("capability_versions_public_id_key").on(table.publicId),
	unique("capability_versions_capability_id_version_key").on(table.capabilityId, table.version),
	unique("capability_versions_id_organization_id_key").on(table.id, table.organizationId),
	check("capability_versions_model_fallback_check", sql`model_fallback = ANY (ARRAY['profile'::text, 'fail'::text])`),
	check("capability_versions_version_check", sql`version > 0`),
]);

export const capabilityReleasesInAi = ai.table("capability_releases", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.capability_releases_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	capabilityId: bigint("capability_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	environmentId: bigint("environment_id", { mode: "bigint" }).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	releasedByUserId: bigint("released_by_user_id", { mode: "bigint" }),
	releasedAt: timestamp("released_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
	evalRunId: bigint("eval_run_id", { mode: "bigint" }),
	minEvalScore: numeric("min_eval_score", { precision: 6, scale:  3 }),
}, (table) => [
	uniqueIndex("capability_releases_active_uq").using("btree", table.capabilityId.asc().nullsLast().op("int8_ops"), table.environmentId.asc().nullsLast().op("int8_ops")).where(sql`is_active`),
	index("capability_releases_cap_org_idx").using("btree", table.capabilityId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("capability_releases_env_org_idx").using("btree", table.environmentId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("capability_releases_eval_idx").using("btree", table.evalRunId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("capability_releases_user_idx").using("btree", table.releasedByUserId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.capabilityId, table.organizationId],
			foreignColumns: [capabilitiesInAi.id, capabilitiesInAi.organizationId],
			name: "capability_releases_capability_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.environmentId],
			foreignColumns: [environmentsInIam.id, environmentsInIam.organizationId],
			name: "capability_releases_environment_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.evalRunId],
			foreignColumns: [evalRunsInAi.id, evalRunsInAi.organizationId],
			name: "capability_releases_eval_fk"
		}),
	foreignKey({
			columns: [table.releasedByUserId],
			foreignColumns: [usersInIam.id],
			name: "capability_releases_released_by_user_id_fkey"
		}).onDelete("set null"),
	unique("capability_releases_public_id_key").on(table.publicId),
	unique("capability_releases_id_organization_id_key").on(table.id, table.organizationId),
]);

export const evalDatasetsInAi = ai.table("eval_datasets", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.eval_datasets_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	capabilityId: bigint("capability_id", { mode: "bigint" }),
	name: text().notNull(),
	description: text(),
	sourceFileId: bigint("source_file_id", { mode: "bigint" }),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("eval_datasets_cap_idx").using("btree", table.capabilityId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("eval_datasets_creator_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	index("eval_datasets_file_idx").using("btree", table.sourceFileId.asc().nullsLast().op("int8_ops")),
	index("eval_datasets_ws_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId, table.capabilityId],
			foreignColumns: [capabilitiesInAi.id, capabilitiesInAi.organizationId],
			name: "eval_datasets_capability_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "eval_datasets_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.sourceFileId],
			foreignColumns: [filesInStorage.id],
			name: "eval_datasets_source_file_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "eval_datasets_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("eval_datasets_public_id_key").on(table.publicId),
	unique("eval_datasets_id_organization_id_key").on(table.id, table.organizationId),
]);

export const evalCasesInAi = ai.table("eval_cases", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.eval_cases_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	datasetId: bigint("dataset_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	input: jsonb().notNull(),
	expected: jsonb(),
	assertions: jsonb().default([]).notNull(),
	tags: text().array().default([""]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("eval_cases_dataset_idx").using("btree", table.datasetId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.datasetId, table.organizationId],
			foreignColumns: [evalDatasetsInAi.id, evalDatasetsInAi.organizationId],
			name: "eval_cases_dataset_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("eval_cases_id_organization_id_key").on(table.id, table.organizationId),
]);

export const evalRunsInAi = ai.table("eval_runs", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.eval_runs_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	datasetId: bigint("dataset_id", { mode: "bigint" }).notNull(),
	capabilityVersionId: bigint("capability_version_id", { mode: "bigint" }).notNull(),
	status: text().default('queued').notNull(),
	score: numeric({ precision: 6, scale:  3 }),
	metrics: jsonb().default({}).notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("eval_runs_creator_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	index("eval_runs_dataset_idx").using("btree", table.datasetId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops"), table.createdAt.desc().nullsFirst().op("int8_ops")),
	index("eval_runs_version_idx").using("btree", table.capabilityVersionId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId, table.capabilityVersionId],
			foreignColumns: [capabilityVersionsInAi.id, capabilityVersionsInAi.organizationId],
			name: "eval_runs_capability_version_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "eval_runs_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.datasetId],
			foreignColumns: [evalDatasetsInAi.id, evalDatasetsInAi.organizationId],
			name: "eval_runs_dataset_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("eval_runs_public_id_key").on(table.publicId),
	unique("eval_runs_id_organization_id_key").on(table.id, table.organizationId),
	check("eval_runs_status_check", sql`status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])`),
]);

export const oauthConnectionsInMcp = mcp.table("oauth_connections", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "mcp.oauth_connections_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	providerKey: text("provider_key").notNull(),
	accountLabel: text("account_label"),
	scopes: text().array().default([""]).notNull(),
	accessSecretId: bigint("access_secret_id", { mode: "bigint" }).notNull(),
	refreshSecretId: bigint("refresh_secret_id", { mode: "bigint" }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true, mode: 'string' }),
	refreshFailures: smallint("refresh_failures").default(0).notNull(),
	status: text().default('active').notNull(),
	connectedByUserId: bigint("connected_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("oauth_connections_access_idx").using("btree", table.accessSecretId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("oauth_connections_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.providerKey.asc().nullsLast().op("int8_ops")),
	index("oauth_connections_refresh_due_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = 'active'::text)`),
	index("oauth_connections_refresh_idx").using("btree", table.refreshSecretId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("oauth_connections_user_idx").using("btree", table.connectedByUserId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId, table.accessSecretId],
			foreignColumns: [secretsInIam.id, secretsInIam.organizationId],
			name: "oauth_connections_access_secret_id_organization_id_fkey"
		}),
	foreignKey({
			columns: [table.connectedByUserId],
			foreignColumns: [usersInIam.id],
			name: "oauth_connections_connected_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "oauth_connections_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.refreshSecretId],
			foreignColumns: [secretsInIam.id, secretsInIam.organizationId],
			name: "oauth_connections_refresh_secret_id_organization_id_fkey"
		}),
	unique("oauth_connections_public_id_key").on(table.publicId),
	unique("oauth_connections_id_organization_id_key").on(table.id, table.organizationId),
	check("oauth_connections_status_check", sql`status = ANY (ARRAY['active'::text, 'expired'::text, 'revoked'::text, 'error'::text])`),
]);

export const bridgesInMcp = mcp.table("bridges", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "mcp.bridges_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	name: text().notNull(),
	// customType: bytea
	tokenHash: bytea("token_hash").notNull(),
	publicKey: text("public_key"),
	agentVersion: text("agent_version"),
	hostInfo: jsonb("host_info").default({}).notNull(),
	status: text().default('pending').notNull(),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: 'string' }),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("bridges_creator_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	index("bridges_offline_idx").using("btree", table.lastSeenAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = 'online'::text)`),
	index("bridges_ws_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "bridges_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "bridges_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("bridges_public_id_key").on(table.publicId),
	unique("bridges_token_hash_key").on(table.tokenHash),
	unique("bridges_id_organization_id_key").on(table.id, table.organizationId),
	check("bridges_status_check", sql`status = ANY (ARRAY['pending'::text, 'online'::text, 'offline'::text, 'revoked'::text])`),
]);

export const connectorsInMcp = mcp.table("connectors", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "mcp.connectors_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	definitionId: bigint("definition_id", { mode: "bigint" }),
	kind: text().notNull(),
	name: text().notNull(),
	description: text(),
	baseUrl: text("base_url"),
	dbEngine: text("db_engine"),
	bridgeId: bigint("bridge_id", { mode: "bigint" }),
	config: jsonb().default({}).notNull(),
	authType: text("auth_type").default('none').notNull(),
	authConfig: jsonb("auth_config").default({}).notNull(),
	safetyConfig: jsonb("safety_config").default({}).notNull(),
	status: text().default('draft').notNull(),
	healthStatus: text("health_status").default('unknown').notNull(),
	consecutiveFailures: smallint("consecutive_failures").default(0).notNull(),
	lastHealthAt: timestamp("last_health_at", { withTimezone: true, mode: 'string' }),
	lastError: text("last_error"),
	sourceListingId: bigint("source_listing_id", { mode: "bigint" }),
	lockVersion: integer("lock_version").default(0).notNull(),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("connectors_bridge_idx").using("btree", table.bridgeId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("connectors_creator_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	index("connectors_definition_idx").using("btree", table.definitionId.asc().nullsLast().op("int8_ops")),
	index("connectors_health_due_idx").using("btree", table.lastHealthAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = 'active'::text)`),
	index("connectors_listing_idx").using("btree", table.sourceListingId.asc().nullsLast().op("int8_ops")),
	index("connectors_ws_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")).where(sql`(deleted_at IS NULL)`),
	foreignKey({
			columns: [table.organizationId, table.bridgeId],
			foreignColumns: [bridgesInMcp.id, bridgesInMcp.organizationId],
			name: "connectors_bridge_id_organization_id_fkey"
		}),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "connectors_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.definitionId],
			foreignColumns: [connectorDefinitionsInMcp.id],
			name: "connectors_definition_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceListingId],
			foreignColumns: [listingsInMarket.id],
			name: "connectors_listing_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "connectors_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("connectors_public_id_key").on(table.publicId),
	unique("connectors_id_organization_id_key").on(table.id, table.organizationId),
	check("connectors_auth_type_check", sql`auth_type = ANY (ARRAY['none'::text, 'api_key'::text, 'bearer'::text, 'basic'::text, 'oauth2'::text, 'hmac'::text, 'mtls'::text, 'db_password'::text, 'bridge_token'::text])`),
	check("connectors_check", sql`(kind <> 'database'::text) OR (db_engine IS NOT NULL)`),
	check("connectors_check1", sql`(kind <> 'bridge'::text) OR (bridge_id IS NOT NULL)`),
	check("connectors_db_engine_check", sql`db_engine = ANY (ARRAY['postgresql'::text, 'mysql'::text, 'mariadb'::text, 'sqlserver'::text, 'sqlite'::text])`),
	check("connectors_health_status_check", sql`health_status = ANY (ARRAY['unknown'::text, 'healthy'::text, 'warning'::text, 'error'::text])`),
	check("connectors_kind_check", sql`kind = ANY (ARRAY['openapi'::text, 'http_undocumented'::text, 'database'::text, 'google_workspace'::text, 'saas'::text, 'files'::text, 'webhook_inbound'::text, 'bridge'::text, 'external_mcp'::text, 'graphql'::text])`),
	check("connectors_status_check", sql`status = ANY (ARRAY['draft'::text, 'testing'::text, 'active'::text, 'error'::text, 'revoked'::text, 'archived'::text])`),
]);

export const connectorCredentialsInMcp = mcp.table("connector_credentials", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "mcp.connector_credentials_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	connectorId: bigint("connector_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	environmentId: bigint("environment_id", { mode: "bigint" }),
	secretId: bigint("secret_id", { mode: "bigint" }),
	oauthConnectionId: bigint("oauth_connection_id", { mode: "bigint" }),
	status: text().default('active').notNull(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("connector_credentials_conn_idx").using("btree", table.connectorId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("connector_credentials_env_idx").using("btree", table.environmentId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("connector_credentials_env_uq").using("btree", table.connectorId.asc().nullsLast().op("int8_ops"), table.environmentId.asc().nullsLast().op("int8_ops")).where(sql`(status = 'active'::text)`),
	index("connector_credentials_oauth_idx").using("btree", table.oauthConnectionId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("connector_credentials_secret_idx").using("btree", table.secretId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.connectorId, table.organizationId],
			foreignColumns: [connectorsInMcp.id, connectorsInMcp.organizationId],
			name: "connector_credentials_connector_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.environmentId],
			foreignColumns: [environmentsInIam.id, environmentsInIam.organizationId],
			name: "connector_credentials_environment_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.oauthConnectionId],
			foreignColumns: [oauthConnectionsInMcp.id, oauthConnectionsInMcp.organizationId],
			name: "connector_credentials_oauth_connection_id_organization_id_fkey"
		}),
	foreignKey({
			columns: [table.organizationId, table.secretId],
			foreignColumns: [secretsInIam.id, secretsInIam.organizationId],
			name: "connector_credentials_secret_id_organization_id_fkey"
		}),
	check("connector_credentials_check", sql`(secret_id IS NOT NULL) OR (oauth_connection_id IS NOT NULL)`),
	check("connector_credentials_status_check", sql`status = ANY (ARRAY['active'::text, 'invalid'::text, 'revoked'::text])`),
]);

export const connectorSourcesInMcp = mcp.table("connector_sources", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "mcp.connector_sources_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	connectorId: bigint("connector_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	sourceType: text("source_type").notNull(),
	fileId: bigint("file_id", { mode: "bigint" }),
	content: jsonb(),
	// customType: bytea
	contentHash: bytea("content_hash"),
	analysis: jsonb().default({}).notNull(),
	fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("connector_sources_conn_idx").using("btree", table.connectorId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops"), table.fetchedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("connector_sources_file_idx").using("btree", table.fileId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.connectorId, table.organizationId],
			foreignColumns: [connectorsInMcp.id, connectorsInMcp.organizationId],
			name: "connector_sources_connector_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [filesInStorage.id],
			name: "connector_sources_file_id_fkey"
		}).onDelete("set null"),
	check("connector_sources_source_type_check", sql`source_type = ANY (ARRAY['openapi_upload'::text, 'openapi_url'::text, 'auto_discovery'::text, 'db_schema'::text, 'nl_description'::text, 'manual'::text, 'graphql_introspection'::text, 'mcp_discovery'::text, 'file_schema'::text])`),
]);

export const connectorActionsInMcp = mcp.table("connector_actions", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "mcp.connector_actions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	connectorId: bigint("connector_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	key: text().notNull(),
	kind: text().notNull(),
	definition: jsonb().notNull(),
	inputSchema: jsonb("input_schema").default({}).notNull(),
	outputSchema: jsonb("output_schema"),
	effect: text().notNull(),
	riskLevel: text("risk_level").notNull(),
	isIdempotent: boolean("is_idempotent").default(false).notNull(),
	generatedBy: text("generated_by").default('ai').notNull(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("connector_actions_conn_org_idx").using("btree", table.connectorId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.connectorId, table.organizationId],
			foreignColumns: [connectorsInMcp.id, connectorsInMcp.organizationId],
			name: "connector_actions_connector_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("connector_actions_public_id_key").on(table.publicId),
	unique("connector_actions_connector_id_key_key").on(table.connectorId, table.key),
	unique("connector_actions_id_organization_id_key").on(table.id, table.organizationId),
	check("connector_actions_check", sql`(kind <> 'sql'::text) OR (effect <> 'delete'::text)`),
	check("connector_actions_effect_check", sql`effect = ANY (ARRAY['read'::text, 'write'::text, 'delete'::text, 'financial'::text, 'external_message'::text])`),
	check("connector_actions_generated_by_check", sql`generated_by = ANY (ARRAY['ai'::text, 'manual'::text, 'prebuilt'::text, 'discovery'::text])`),
	check("connector_actions_kind_check", sql`kind = ANY (ARRAY['http'::text, 'sql'::text, 'google_api'::text, 'saas_api'::text, 'file_query'::text, 'mcp_proxy'::text, 'graphql'::text])`),
	check("connector_actions_risk_level_check", sql`risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])`),
	check("connector_actions_status_check", sql`status = ANY (ARRAY['active'::text, 'disabled'::text, 'broken'::text])`),
]);

export const fileDatasetsInMcp = mcp.table("file_datasets", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "mcp.file_datasets_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	connectorId: bigint("connector_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	fileId: bigint("file_id", { mode: "bigint" }),
	refreshUrl: text("refresh_url"),
	refreshCron: text("refresh_cron"),
	detectedSchema: jsonb("detected_schema").default({}).notNull(),
	rowCount: bigint("row_count", { mode: "bigint" }),
	lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true, mode: 'string' }),
	status: text().default('ready').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("file_datasets_conn_idx").using("btree", table.connectorId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("file_datasets_file_idx").using("btree", table.fileId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.connectorId, table.organizationId],
			foreignColumns: [connectorsInMcp.id, connectorsInMcp.organizationId],
			name: "file_datasets_connector_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [filesInStorage.id],
			name: "file_datasets_file_id_fkey"
		}).onDelete("set null"),
	unique("file_datasets_public_id_key").on(table.publicId),
	check("file_datasets_status_check", sql`status = ANY (ARRAY['processing'::text, 'ready'::text, 'error'::text])`),
]);

export const serversInMcp = mcp.table("servers", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "mcp.servers_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	// customType: citext
	slug: citext("slug").notNull(),
	name: text().notNull(),
	description: text(),
	instructions: text(),
	visibility: text().default('private').notNull(),
	status: text().default('draft').notNull(),
	activeVersionId: bigint("active_version_id", { mode: "bigint" }),
	authModes: text("auth_modes").array().default(["oauth"]).notNull(),
	toolRoutingEnabled: boolean("tool_routing_enabled").default(false).notNull(),
	toolRoutingTopK: smallint("tool_routing_top_k").default(10).notNull(),
	rateLimits: jsonb("rate_limits").default({}).notNull(),
	suspendedReason: text("suspended_reason"),
	sourceListingId: bigint("source_listing_id", { mode: "bigint" }),
	lockVersion: integer("lock_version").default(0).notNull(),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("servers_active_ver_idx").using("btree", table.activeVersionId.asc().nullsLast().op("int8_ops")),
	index("servers_creator_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	index("servers_listing_idx").using("btree", table.sourceListingId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("servers_slug_uq").using("btree", table.workspaceId.asc().nullsLast().op("citext_ops"), table.slug.asc().nullsLast().op("citext_ops")).where(sql`(deleted_at IS NULL)`),
	index("servers_ws_org_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.activeVersionId],
			foreignColumns: [serverVersionsInMcp.id],
			name: "servers_active_version_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "servers_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.sourceListingId],
			foreignColumns: [listingsInMarket.id],
			name: "servers_listing_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "servers_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("servers_public_id_key").on(table.publicId),
	unique("servers_id_organization_id_key").on(table.id, table.organizationId),
	check("servers_auth_modes_check", sql`auth_modes <@ ARRAY['oauth'::text, 'static_token'::text, 'api_key'::text]`),
	check("servers_slug_check", sql`slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'::citext`),
	check("servers_status_check", sql`status = ANY (ARRAY['draft'::text, 'validating'::text, 'active'::text, 'failed'::text, 'deprecated'::text, 'suspended'::text, 'archived'::text])`),
	check("servers_visibility_check", sql`visibility = ANY (ARRAY['private'::text, 'organization'::text, 'public'::text])`),
]);

export const serverVersionsInMcp = mcp.table("server_versions", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "mcp.server_versions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	serverId: bigint("server_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	versionSeq: integer("version_seq").notNull(),
	semver: text().notNull(),
	status: text().default('validating').notNull(),
	configSnapshot: jsonb("config_snapshot").notNull(),
	// customType: bytea
	snapshotHash: bytea("snapshot_hash").notNull(),
	validationReport: jsonb("validation_report").default({}).notNull(),
	changelog: text(),
	publishedByUserId: bigint("published_by_user_id", { mode: "bigint" }),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("server_versions_publisher_idx").using("btree", table.publishedByUserId.asc().nullsLast().op("int8_ops")),
	index("server_versions_srv_org_idx").using("btree", table.serverId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.publishedByUserId],
			foreignColumns: [usersInIam.id],
			name: "server_versions_published_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.serverId, table.organizationId],
			foreignColumns: [serversInMcp.id, serversInMcp.organizationId],
			name: "server_versions_server_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("server_versions_public_id_key").on(table.publicId),
	unique("server_versions_server_id_version_seq_key").on(table.serverId, table.versionSeq),
	unique("server_versions_server_id_semver_key").on(table.semver, table.serverId),
	unique("server_versions_id_organization_id_key").on(table.id, table.organizationId),
	check("server_versions_semver_check", sql`semver ~ '^[0-9]+\.[0-9]+\.[0-9]+$'::text`),
	check("server_versions_status_check", sql`status = ANY (ARRAY['validating'::text, 'published'::text, 'failed'::text, 'superseded'::text, 'rolled_back'::text])`),
	check("server_versions_version_seq_check", sql`version_seq > 0`),
]);

export const toolsInMcp = mcp.table("tools", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "mcp.tools_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	serverId: bigint("server_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	actionId: bigint("action_id", { mode: "bigint" }),
	name: text().notNull(),
	title: jsonb(),
	description: text().notNull(),
	inputSchema: jsonb("input_schema").default({"type":"object"}).notNull(),
	outputSchema: jsonb("output_schema"),
	inputMapping: jsonb("input_mapping").default({}).notNull(),
	outputTransform: jsonb("output_transform").default({}).notNull(),
	compositePlan: jsonb("composite_plan"),
	effect: text().notNull(),
	riskLevel: text("risk_level").notNull(),
	requiresApproval: boolean("requires_approval").default(false).notNull(),
	approvalRules: jsonb("approval_rules").default({}).notNull(),
	isEnabled: boolean("is_enabled").default(true).notNull(),
	timeoutMs: integer("timeout_ms").default(30000).notNull(),
	retryPolicy: jsonb("retry_policy").default({"backoff":[1000,3000,9000],"max_attempts":3}).notNull(),
	rateLimit: jsonb("rate_limit").default({}).notNull(),
	qualityScore: numeric("quality_score", { precision: 5, scale:  2 }),
	position: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("tools_action_idx").using("btree", table.actionId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("tools_srv_org_idx").using("btree", table.serverId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int4_ops"), table.position.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.organizationId, table.actionId],
			foreignColumns: [connectorActionsInMcp.id, connectorActionsInMcp.organizationId],
			name: "tools_action_id_organization_id_fkey"
		}),
	foreignKey({
			columns: [table.serverId, table.organizationId],
			foreignColumns: [serversInMcp.id, serversInMcp.organizationId],
			name: "tools_server_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("tools_public_id_key").on(table.publicId),
	unique("tools_server_id_name_key").on(table.name, table.serverId),
	unique("tools_id_organization_id_key").on(table.id, table.organizationId),
	check("tools_check", sql`(action_id IS NOT NULL) OR (composite_plan IS NOT NULL)`),
	check("tools_check1", sql`(effect <> ALL (ARRAY['delete'::text, 'financial'::text])) OR requires_approval`),
	check("tools_description_check", sql`length(description) >= 10`),
	check("tools_effect_check", sql`effect = ANY (ARRAY['read'::text, 'write'::text, 'delete'::text, 'financial'::text, 'external_message'::text])`),
	check("tools_name_check", sql`name ~ '^[a-z][a-z0-9_]{0,63}$'::text`),
	check("tools_risk_level_check", sql`risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])`),
	check("tools_timeout_ms_check", sql`(timeout_ms >= 1000) AND (timeout_ms <= 120000)`),
	check("tools_title_check", sql`(title IS NULL) OR util.is_i18n(title)`),
]);

export const toolEmbeddingsInMcp = mcp.table("tool_embeddings", {
	toolId: bigint("tool_id", { mode: "bigint" }).primaryKey().notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	serverId: bigint("server_id", { mode: "bigint" }).notNull(),
	embeddingModel: text("embedding_model").notNull(),
	embedding: vector({ dimensions: 1536 }).notNull(),
	// customType: bytea
	contentHash: bytea("content_hash").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("tool_embeddings_hnsw").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
	index("tool_embeddings_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("tool_embeddings_server_idx").using("btree", table.serverId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.toolId],
			foreignColumns: [toolsInMcp.id],
			name: "tool_embeddings_tool_id_fkey"
		}).onDelete("cascade"),
]);

export const resourcesInMcp = mcp.table("resources", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "mcp.resources_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	serverId: bigint("server_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	actionId: bigint("action_id", { mode: "bigint" }),
	uriTemplate: text("uri_template").notNull(),
	name: text().notNull(),
	description: text(),
	mimeType: text("mime_type").default('application/json').notNull(),
	isEnabled: boolean("is_enabled").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("resources_action_idx").using("btree", table.actionId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("resources_srv_org_idx").using("btree", table.serverId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId, table.actionId],
			foreignColumns: [connectorActionsInMcp.id, connectorActionsInMcp.organizationId],
			name: "resources_action_id_organization_id_fkey"
		}),
	foreignKey({
			columns: [table.serverId, table.organizationId],
			foreignColumns: [serversInMcp.id, serversInMcp.organizationId],
			name: "resources_server_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("resources_public_id_key").on(table.publicId),
	unique("resources_server_id_uri_template_key").on(table.serverId, table.uriTemplate),
]);

export const promptsInMcp = mcp.table("prompts", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "mcp.prompts_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	serverId: bigint("server_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	name: text().notNull(),
	description: text(),
	arguments: jsonb().default([]).notNull(),
	template: text().notNull(),
	isEnabled: boolean("is_enabled").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("prompts_srv_org_idx").using("btree", table.serverId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.serverId, table.organizationId],
			foreignColumns: [serversInMcp.id, serversInMcp.organizationId],
			name: "prompts_server_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("prompts_public_id_key").on(table.publicId),
	unique("prompts_server_id_name_key").on(table.name, table.serverId),
	check("prompts_name_check", sql`name ~ '^[a-z][a-z0-9_]{0,63}$'::text`),
]);

export const accessTokensInMcp = mcp.table("access_tokens", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "mcp.access_tokens_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	serverId: bigint("server_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	environmentId: bigint("environment_id", { mode: "bigint" }),
	name: text().notNull(),
	prefix: text().notNull(),
	// customType: bytea
	tokenHash: bytea("token_hash").notNull(),
	scopeMode: text("scope_mode").default('read_only').notNull(),
	rateLimit: jsonb("rate_limit").default({}).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	lastUsedIp: inet("last_used_ip"),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	revokedByUserId: bigint("revoked_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("access_tokens_creator_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	index("access_tokens_env_idx").using("btree", table.environmentId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("access_tokens_revoker_idx").using("btree", table.revokedByUserId.asc().nullsLast().op("int8_ops")),
	index("access_tokens_srv_idx").using("btree", table.serverId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")).where(sql`(revoked_at IS NULL)`),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "access_tokens_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.environmentId],
			foreignColumns: [environmentsInIam.id, environmentsInIam.organizationId],
			name: "access_tokens_environment_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.revokedByUserId],
			foreignColumns: [usersInIam.id],
			name: "access_tokens_revoked_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.serverId, table.organizationId],
			foreignColumns: [serversInMcp.id, serversInMcp.organizationId],
			name: "access_tokens_server_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("access_tokens_public_id_key").on(table.publicId),
	unique("access_tokens_prefix_key").on(table.prefix),
	unique("access_tokens_token_hash_key").on(table.tokenHash),
	unique("access_tokens_id_organization_id_key").on(table.id, table.organizationId),
	check("access_tokens_scope_mode_check", sql`scope_mode = ANY (ARRAY['read_only'::text, 'read_write'::text, 'full'::text, 'custom'::text])`),
]);

export const healthChecksInMcp = mcp.table("health_checks", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "mcp.health_checks_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	targetType: text("target_type").notNull(),
	targetId: bigint("target_id", { mode: "bigint" }).notNull(),
	checkType: text("check_type").notNull(),
	status: text().notNull(),
	latencyMs: integer("latency_ms"),
	errorCode: text("error_code"),
	errorMessage: text("error_message"),
	checkedAt: timestamp("checked_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("health_checks_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.checkedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("health_checks_purge_idx").using("btree", table.checkedAt.asc().nullsLast().op("timestamptz_ops")),
	index("health_checks_target_idx").using("btree", table.targetType.asc().nullsLast().op("timestamptz_ops"), table.targetId.asc().nullsLast().op("text_ops"), table.checkedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "health_checks_organization_id_fkey"
		}).onDelete("cascade"),
	check("health_checks_check_type_check", sql`check_type = ANY (ARRAY['ping'::text, 'sanity_tool'::text, 'auth'::text, 'schema_drift'::text])`),
	check("health_checks_status_check", sql`status = ANY (ARRAY['ok'::text, 'warning'::text, 'error'::text])`),
	check("health_checks_target_type_check", sql`target_type = ANY (ARRAY['connector'::text, 'server'::text, 'bridge'::text, 'tool'::text])`),
]);

export const oauthConsentsInIam = iam.table("oauth_consents", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.oauth_consents_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	userId: bigint("user_id", { mode: "bigint" }).notNull(),
	clientId: bigint("client_id", { mode: "bigint" }).notNull(),
	mcpServerId: bigint("mcp_server_id", { mode: "bigint" }).notNull(),
	environmentId: bigint("environment_id", { mode: "bigint" }),
	scopes: text().array().notNull(),
	allowedToolIds: bigint("allowed_tool_ids", { mode: "bigint" }).array(),
	grantedAt: timestamp("granted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("oauth_consents_active_uq").using("btree", table.userId.asc().nullsLast().op("int8_ops"), table.clientId.asc().nullsLast().op("int8_ops"), table.mcpServerId.asc().nullsLast().op("int8_ops")).where(sql`(revoked_at IS NULL)`),
	index("oauth_consents_client_idx").using("btree", table.clientId.asc().nullsLast().op("int8_ops")),
	index("oauth_consents_env_idx").using("btree", table.environmentId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("oauth_consents_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("oauth_consents_server_idx").using("btree", table.mcpServerId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [oauthClientsInIam.id],
			name: "oauth_consents_client_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.environmentId],
			foreignColumns: [environmentsInIam.id, environmentsInIam.organizationId],
			name: "oauth_consents_environment_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.mcpServerId],
			foreignColumns: [serversInMcp.id, serversInMcp.organizationId],
			name: "oauth_consents_mcp_server_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "oauth_consents_user_id_fkey"
		}).onDelete("cascade"),
	unique("oauth_consents_public_id_key").on(table.publicId),
]);

export const oauthAuthorizationCodesInIam = iam.table("oauth_authorization_codes", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.oauth_authorization_codes_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// customType: bytea
	codeHash: bytea("code_hash").notNull(),
	clientId: bigint("client_id", { mode: "bigint" }).notNull(),
	userId: bigint("user_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	consentId: bigint("consent_id", { mode: "bigint" }).notNull(),
	resource: text().notNull(),
	scopes: text().array().notNull(),
	redirectUri: text("redirect_uri").notNull(),
	codeChallenge: text("code_challenge").notNull(),
	codeChallengeMethod: text("code_challenge_method").default('S256').notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	consumedAt: timestamp("consumed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("oauth_codes_client_idx").using("btree", table.clientId.asc().nullsLast().op("int8_ops")),
	index("oauth_codes_consent_idx").using("btree", table.consentId.asc().nullsLast().op("int8_ops")),
	index("oauth_codes_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(consumed_at IS NULL)`),
	index("oauth_codes_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("oauth_codes_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [oauthClientsInIam.id],
			name: "oauth_authorization_codes_client_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.consentId],
			foreignColumns: [oauthConsentsInIam.id],
			name: "oauth_authorization_codes_consent_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "oauth_authorization_codes_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "oauth_authorization_codes_user_id_fkey"
		}).onDelete("cascade"),
	unique("oauth_authorization_codes_code_hash_key").on(table.codeHash),
	check("oauth_authorization_codes_code_challenge_method_check", sql`code_challenge_method = 'S256'::text`),
]);

export const oauthTokensInIam = iam.table("oauth_tokens", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.oauth_tokens_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// customType: bytea
	tokenHash: bytea("token_hash").notNull(),
	tokenType: text("token_type").notNull(),
	familyId: uuid("family_id").notNull(),
	parentTokenId: bigint("parent_token_id", { mode: "bigint" }),
	clientId: bigint("client_id", { mode: "bigint" }).notNull(),
	userId: bigint("user_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	consentId: bigint("consent_id", { mode: "bigint" }).notNull(),
	mcpServerId: bigint("mcp_server_id", { mode: "bigint" }).notNull(),
	scopes: text().array().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	revokedReason: text("revoked_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("oauth_tokens_client_idx").using("btree", table.clientId.asc().nullsLast().op("int8_ops")),
	index("oauth_tokens_consent_idx").using("btree", table.consentId.asc().nullsLast().op("int8_ops")),
	index("oauth_tokens_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(revoked_at IS NULL)`),
	index("oauth_tokens_family_idx").using("btree", table.familyId.asc().nullsLast().op("uuid_ops")),
	index("oauth_tokens_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("oauth_tokens_parent_idx").using("btree", table.parentTokenId.asc().nullsLast().op("int8_ops")),
	index("oauth_tokens_server_idx").using("btree", table.mcpServerId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("oauth_tokens_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops")).where(sql`(revoked_at IS NULL)`),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [oauthClientsInIam.id],
			name: "oauth_tokens_client_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.consentId],
			foreignColumns: [oauthConsentsInIam.id],
			name: "oauth_tokens_consent_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.mcpServerId],
			foreignColumns: [serversInMcp.id, serversInMcp.organizationId],
			name: "oauth_tokens_mcp_server_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "oauth_tokens_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.parentTokenId],
			foreignColumns: [table.id],
			name: "oauth_tokens_parent_token_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "oauth_tokens_user_id_fkey"
		}).onDelete("cascade"),
	unique("oauth_tokens_token_hash_key").on(table.tokenHash),
	check("oauth_tokens_token_type_check", sql`token_type = ANY (ARRAY['access'::text, 'refresh'::text])`),
]);

export const agentsInAgent = agent.table("agents", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "agent.agents_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	name: text().notNull(),
	description: text(),
	status: text().default('draft').notNull(),
	pausedReason: text("paused_reason"),
	currentVersionId: bigint("current_version_id", { mode: "bigint" }),
	maxConcurrency: smallint("max_concurrency").default(1).notNull(),
	sourceListingId: bigint("source_listing_id", { mode: "bigint" }),
	lockVersion: integer("lock_version").default(0).notNull(),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	archivedAt: timestamp("archived_at", { withTimezone: true, mode: 'string' }),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("agents_creator_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	index("agents_listing_idx").using("btree", table.sourceListingId.asc().nullsLast().op("int8_ops")),
	index("agents_name_trgm").using("gin", table.name.asc().nullsLast().op("gin_trgm_ops")),
	index("agents_version_idx").using("btree", table.currentVersionId.asc().nullsLast().op("int8_ops")),
	index("agents_ws_status_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.organizationId.asc().nullsLast().op("int8_ops"), table.status.asc().nullsLast().op("int8_ops")).where(sql`(deleted_at IS NULL)`),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "agents_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.currentVersionId],
			foreignColumns: [versionsInAgent.id],
			name: "agents_current_version_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.sourceListingId],
			foreignColumns: [listingsInMarket.id],
			name: "agents_listing_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "agents_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("agents_public_id_key").on(table.publicId),
	unique("agents_id_organization_id_key").on(table.id, table.organizationId),
	check("agents_max_concurrency_check", sql`(max_concurrency >= 1) AND (max_concurrency <= 100)`),
	check("agents_status_check", sql`status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'archived'::text])`),
]);

export const versionsInAgent = agent.table("versions", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "agent.versions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	agentId: bigint("agent_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	versionSeq: integer("version_seq").notNull(),
	objective: text().notNull(),
	instructions: text(),
	language: text().default('fr').notNull(),
	routingProfileId: bigint("routing_profile_id", { mode: "bigint" }),
	modelOverrideId: bigint("model_override_id", { mode: "bigint" }),
	modelFallback: text("model_fallback").default('profile').notNull(),
	temperature: numeric({ precision: 3, scale:  2 }).default('0.30').notNull(),
	maxTokensPerCall: integer("max_tokens_per_call"),
	maxIterations: smallint("max_iterations").default(10).notNull(),
	runTimeoutS: integer("run_timeout_s").default(300).notNull(),
	toolTimeoutS: integer("tool_timeout_s").default(30).notNull(),
	maxNestingDepth: smallint("max_nesting_depth").default(5).notNull(),
	outputMode: text("output_mode").default('text').notNull(),
	outputSchema: jsonb("output_schema"),
	memoryConfig: jsonb("memory_config").default({"scope":"agent","long_term":false,"retention_days":30}).notNull(),
	approvalConfig: jsonb("approval_config").default({"channels":["dashboard"],"timeout_hours":24}).notNull(),
	budgetPerRunMicro: bigint("budget_per_run_micro", { mode: "bigint" }),
	onBudgetExceeded: text("on_budget_exceeded").default('stop').notNull(),
	allowedHours: jsonb("allowed_hours"),
	selfActions: jsonb("self_actions").default({"modify_agents":false,"trigger_other_agents":false}).notNull(),
	changelog: text(),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("versions_agent_org_idx").using("btree", table.agentId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("versions_creator_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	index("versions_language_idx").using("btree", table.language.asc().nullsLast().op("text_ops")),
	index("versions_model_idx").using("btree", table.modelOverrideId.asc().nullsLast().op("int8_ops")),
	index("versions_profile_idx").using("btree", table.routingProfileId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.agentId, table.organizationId],
			foreignColumns: [agentsInAgent.id, agentsInAgent.organizationId],
			name: "versions_agent_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "versions_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.language],
			foreignColumns: [languagesInRef.code],
			name: "versions_language_fkey"
		}),
	foreignKey({
			columns: [table.modelOverrideId],
			foreignColumns: [modelsInAi.id],
			name: "versions_model_override_id_fkey"
		}),
	foreignKey({
			columns: [table.routingProfileId],
			foreignColumns: [routingProfilesInAi.id],
			name: "versions_routing_profile_id_fkey"
		}),
	unique("versions_public_id_key").on(table.publicId),
	unique("versions_agent_id_version_seq_key").on(table.agentId, table.versionSeq),
	unique("versions_id_organization_id_key").on(table.id, table.organizationId),
	check("versions_budget_per_run_micro_check", sql`budget_per_run_micro > 0`),
	check("versions_check", sql`(output_mode <> 'json'::text) OR (output_schema IS NOT NULL)`),
	check("versions_max_iterations_check", sql`(max_iterations >= 1) AND (max_iterations <= 50)`),
	check("versions_max_nesting_depth_check", sql`(max_nesting_depth >= 1) AND (max_nesting_depth <= 5)`),
	check("versions_max_tokens_per_call_check", sql`max_tokens_per_call > 0`),
	check("versions_model_fallback_check", sql`model_fallback = ANY (ARRAY['profile'::text, 'fail'::text])`),
	check("versions_on_budget_exceeded_check", sql`on_budget_exceeded = ANY (ARRAY['stop'::text, 'ask_approval'::text])`),
	check("versions_output_mode_check", sql`output_mode = ANY (ARRAY['text'::text, 'json'::text, 'action'::text])`),
	check("versions_run_timeout_s_check", sql`(run_timeout_s >= 10) AND (run_timeout_s <= 1800)`),
	check("versions_temperature_check", sql`(temperature >= (0)::numeric) AND (temperature <= (2)::numeric)`),
	check("versions_tool_timeout_s_check", sql`(tool_timeout_s >= 1) AND (tool_timeout_s <= 120)`),
	check("versions_version_seq_check", sql`version_seq > 0`),
]);

export const toolGrantsInAgent = agent.table("tool_grants", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "agent.tool_grants_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	agentVersionId: bigint("agent_version_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	mcpServerId: bigint("mcp_server_id", { mode: "bigint" }).notNull(),
	pinnedVersionId: bigint("pinned_version_id", { mode: "bigint" }),
	toolId: bigint("tool_id", { mode: "bigint" }),
	permission: text().default('allow').notNull(),
}, (table) => [
	index("tool_grants_pinned_idx").using("btree", table.pinnedVersionId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("tool_grants_server_idx").using("btree", table.mcpServerId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("tool_grants_tool_idx").using("btree", table.toolId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("tool_grants_uq").using("btree", table.agentVersionId.asc().nullsLast().op("int8_ops"), table.mcpServerId.asc().nullsLast().op("int8_ops"), table.toolId.asc().nullsLast().op("int8_ops")),
	index("tool_grants_version_idx").using("btree", table.agentVersionId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.agentVersionId, table.organizationId],
			foreignColumns: [versionsInAgent.id, versionsInAgent.organizationId],
			name: "tool_grants_agent_version_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.mcpServerId],
			foreignColumns: [serversInMcp.id, serversInMcp.organizationId],
			name: "tool_grants_mcp_server_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.pinnedVersionId],
			foreignColumns: [serverVersionsInMcp.id, serverVersionsInMcp.organizationId],
			name: "tool_grants_pinned_version_id_organization_id_fkey"
		}),
	foreignKey({
			columns: [table.organizationId, table.toolId],
			foreignColumns: [toolsInMcp.id, toolsInMcp.organizationId],
			name: "tool_grants_tool_id_organization_id_fkey"
		}).onDelete("cascade"),
	check("tool_grants_permission_check", sql`permission = ANY (ARRAY['allow'::text, 'require_approval'::text, 'deny'::text])`),
]);

export const triggersInAgent = agent.table("triggers", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "agent.triggers_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	agentId: bigint("agent_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	environmentId: bigint("environment_id", { mode: "bigint" }).notNull(),
	kind: text().notNull(),
	isEnabled: boolean("is_enabled").default(true).notNull(),
	cronExpression: text("cron_expression"),
	timezone: text(),
	webhookEndpointId: bigint("webhook_endpoint_id", { mode: "bigint" }),
	eventFilter: jsonb("event_filter"),
	thresholdConfig: jsonb("threshold_config"),
	inputTemplate: jsonb("input_template").default({}).notNull(),
	nextFireAt: timestamp("next_fire_at", { withTimezone: true, mode: 'string' }),
	lastFiredAt: timestamp("last_fired_at", { withTimezone: true, mode: 'string' }),
	temporalScheduleId: text("temporal_schedule_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("triggers_agent_idx").using("btree", table.agentId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("triggers_due_idx").using("btree", table.nextFireAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(is_enabled AND (kind = ANY (ARRAY['schedule'::text, 'threshold'::text])))`),
	index("triggers_env_idx").using("btree", table.environmentId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("triggers_webhook_idx").using("btree", table.webhookEndpointId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.agentId, table.organizationId],
			foreignColumns: [agentsInAgent.id, agentsInAgent.organizationId],
			name: "triggers_agent_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.environmentId],
			foreignColumns: [environmentsInIam.id, environmentsInIam.organizationId],
			name: "triggers_environment_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.webhookEndpointId],
			foreignColumns: [webhookEndpointsInDev.id, webhookEndpointsInDev.organizationId],
			name: "triggers_webhook_endpoint_fk"
		}).onDelete("cascade"),
	unique("triggers_public_id_key").on(table.publicId),
	unique("triggers_id_organization_id_key").on(table.id, table.organizationId),
	check("triggers_check", sql`(kind <> 'schedule'::text) OR (cron_expression IS NOT NULL)`),
	check("triggers_check1", sql`(kind <> 'webhook'::text) OR (webhook_endpoint_id IS NOT NULL)`),
	check("triggers_check2", sql`(kind <> 'threshold'::text) OR (threshold_config IS NOT NULL)`),
	check("triggers_kind_check", sql`kind = ANY (ARRAY['schedule'::text, 'webhook'::text, 'chat'::text, 'threshold'::text, 'manual'::text, 'event'::text])`),
]);

export const approvalsInAgent = agent.table("approvals", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "agent.approvals_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	runId: bigint("run_id", { mode: "bigint" }).notNull(),
	runCreatedAt: timestamp("run_created_at", { withTimezone: true, mode: 'string' }).notNull(),
	agentId: bigint("agent_id", { mode: "bigint" }),
	toolId: bigint("tool_id", { mode: "bigint" }),
	mcpServerId: bigint("mcp_server_id", { mode: "bigint" }),
	proposedInput: jsonb("proposed_input").notNull(),
	summary: jsonb().notNull(),
	riskLevel: text("risk_level").notNull(),
	status: text().default('pending').notNull(),
	requestedAt: timestamp("requested_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	decidedByUserId: bigint("decided_by_user_id", { mode: "bigint" }),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	decisionNote: text("decision_note"),
	editedInput: jsonb("edited_input"),
	channelsNotified: text("channels_notified").array().default([""]).notNull(),
}, (table) => [
	index("approvals_agent_idx").using("btree", table.agentId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("approvals_decider_idx").using("btree", table.decidedByUserId.asc().nullsLast().op("int8_ops")),
	index("approvals_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = 'pending'::text)`),
	index("approvals_pending_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.requestedAt.desc().nullsFirst().op("int8_ops")).where(sql`(status = 'pending'::text)`),
	index("approvals_run_idx").using("btree", table.runId.asc().nullsLast().op("int8_ops")),
	index("approvals_server_idx").using("btree", table.mcpServerId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("approvals_tool_idx").using("btree", table.toolId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("approvals_ws_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId, table.agentId],
			foreignColumns: [agentsInAgent.id, agentsInAgent.organizationId],
			name: "approvals_agent_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.decidedByUserId],
			foreignColumns: [usersInIam.id],
			name: "approvals_decided_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.mcpServerId],
			foreignColumns: [serversInMcp.id, serversInMcp.organizationId],
			name: "approvals_mcp_server_id_organization_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.toolId],
			foreignColumns: [toolsInMcp.id, toolsInMcp.organizationId],
			name: "approvals_tool_id_organization_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "approvals_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("approvals_public_id_key").on(table.publicId),
	check("approvals_risk_level_check", sql`risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])`),
	check("approvals_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text, 'cancelled'::text])`),
	check("approvals_summary_check", sql`CHECK (util.is_i18n(summary`),
]);

export const memoriesInAgent = agent.table("memories", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "agent.memories_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	agentId: bigint("agent_id", { mode: "bigint" }),
	scope: text().notNull(),
	content: text().notNull(),
	embeddingModel: text("embedding_model").notNull(),
	embedding: vector({ dimensions: 1536 }).notNull(),
	metadata: jsonb().default({}).notNull(),
	importance: smallint().default(5).notNull(),
	sourceRunId: bigint("source_run_id", { mode: "bigint" }),
	sizeBytes: integer("size_bytes").default(0).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("memories_agent_idx").using("btree", table.agentId.asc().nullsLast().op("timestamptz_ops"), table.organizationId.asc().nullsLast().op("int8_ops"), table.createdAt.desc().nullsFirst().op("int8_ops")),
	index("memories_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(expires_at IS NOT NULL)`),
	index("memories_hnsw").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
	index("memories_ws_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId, table.agentId],
			foreignColumns: [agentsInAgent.id, agentsInAgent.organizationId],
			name: "memories_agent_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "memories_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("memories_public_id_key").on(table.publicId),
	check("memories_check", sql`(scope = 'agent'::text) = (agent_id IS NOT NULL)`),
	check("memories_importance_check", sql`(importance >= 1) AND (importance <= 10)`),
	check("memories_scope_check", sql`scope = ANY (ARRAY['agent'::text, 'workspace'::text])`),
]);

export const conversationsInAgent = agent.table("conversations", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "agent.conversations_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	environmentId: bigint("environment_id", { mode: "bigint" }),
	agentId: bigint("agent_id", { mode: "bigint" }),
	userId: bigint("user_id", { mode: "bigint" }),
	endUserId: bigint("end_user_id", { mode: "bigint" }),
	title: text(),
	isPinned: boolean("is_pinned").default(false).notNull(),
	status: text().default('active').notNull(),
	messageCount: integer("message_count").default(0).notNull(),
	lastMessageAt: timestamp("last_message_at", { withTimezone: true, mode: 'string' }),
	summary: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("conversations_agent_idx").using("btree", table.agentId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("conversations_env_idx").using("btree", table.environmentId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("conversations_eu_idx").using("btree", table.endUserId.asc().nullsLast().op("int8_ops")),
	index("conversations_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops"), table.lastMessageAt.desc().nullsFirst().op("int8_ops")).where(sql`(status = 'active'::text)`),
	index("conversations_ws_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId, table.agentId],
			foreignColumns: [agentsInAgent.id, agentsInAgent.organizationId],
			name: "conversations_agent_id_organization_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.endUserId],
			foreignColumns: [endUsersInDev.id],
			name: "conversations_end_user_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.environmentId],
			foreignColumns: [environmentsInIam.id, environmentsInIam.organizationId],
			name: "conversations_environment_id_organization_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "conversations_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "conversations_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("conversations_public_id_key").on(table.publicId),
	unique("conversations_id_organization_id_key").on(table.id, table.organizationId),
	check("conversations_status_check", sql`status = ANY (ARRAY['active'::text, 'archived'::text])`),
]);

export const messagesInAgent = agent.table("messages", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "agent.messages_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	conversationId: bigint("conversation_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	role: text().notNull(),
	content: jsonb().notNull(),
	runId: bigint("run_id", { mode: "bigint" }),
	runCreatedAt: timestamp("run_created_at", { withTimezone: true, mode: 'string' }),
	authorUserId: bigint("author_user_id", { mode: "bigint" }),
	feedback: smallint(),
	feedbackNote: text("feedback_note"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("messages_author_idx").using("btree", table.authorUserId.asc().nullsLast().op("int8_ops")),
	index("messages_conversation_idx").using("btree", table.conversationId.asc().nullsLast().op("timestamptz_ops"), table.organizationId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("int8_ops")),
	index("messages_run_idx").using("btree", table.runId.asc().nullsLast().op("int8_ops")).where(sql`(run_id IS NOT NULL)`),
	foreignKey({
			columns: [table.authorUserId],
			foreignColumns: [usersInIam.id],
			name: "messages_author_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.conversationId, table.organizationId],
			foreignColumns: [conversationsInAgent.id, conversationsInAgent.organizationId],
			name: "messages_conversation_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("messages_public_id_key").on(table.publicId),
	check("messages_feedback_check", sql`feedback = ANY (ARRAY['-1'::integer, 1])`),
	check("messages_role_check", sql`role = ANY (ARRAY['user'::text, 'assistant'::text, 'tool'::text, 'system'::text])`),
]);

export const apiKeysInDev = dev.table("api_keys", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "dev.api_keys_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	environmentId: bigint("environment_id", { mode: "bigint" }).notNull(),
	projectId: bigint("project_id", { mode: "bigint" }),
	name: text().notNull(),
	prefix: text().notNull(),
	// customType: bytea
	keyHash: bytea("key_hash").notNull(),
	scopes: text().array().default(["run", "mcp.call"]).notNull(),
	allowedIps: cidr("allowed_ips").array(),
	allowedOrigins: text("allowed_origins").array(),
	rateLimitPerMin: integer("rate_limit_per_min"),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	lastUsedIp: inet("last_used_ip"),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	revokedBy: jsonb("revoked_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("api_keys_creator_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	index("api_keys_env_idx").using("btree", table.environmentId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("api_keys_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`((revoked_at IS NULL) AND (expires_at IS NOT NULL))`),
	index("api_keys_project_idx").using("btree", table.projectId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("api_keys_ws_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")).where(sql`(revoked_at IS NULL)`),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "api_keys_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.environmentId],
			foreignColumns: [environmentsInIam.id, environmentsInIam.organizationId],
			name: "api_keys_environment_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.projectId],
			foreignColumns: [projectsInIam.id, projectsInIam.organizationId],
			name: "api_keys_project_id_organization_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "api_keys_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("api_keys_public_id_key").on(table.publicId),
	unique("api_keys_prefix_key").on(table.prefix),
	unique("api_keys_key_hash_key").on(table.keyHash),
	unique("api_keys_id_organization_id_key").on(table.id, table.organizationId),
	check("api_keys_rate_limit_per_min_check", sql`rate_limit_per_min > 0`),
]);

export const endUsersInDev = dev.table("end_users", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "dev.end_users_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	externalRef: text("external_ref").notNull(),
	displayName: text("display_name"),
	tier: text(),
	metadata: jsonb().default({}).notNull(),
	firstSeenAt: timestamp("first_seen_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	blockedAt: timestamp("blocked_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("end_users_tier_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.tier.asc().nullsLast().op("int8_ops")),
	index("end_users_ws_org_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "end_users_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("end_users_public_id_key").on(table.publicId),
	unique("end_users_workspace_id_external_ref_key").on(table.externalRef, table.workspaceId),
	unique("end_users_id_organization_id_key").on(table.id, table.organizationId),
]);

export const webhookEndpointsInDev = dev.table("webhook_endpoints", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "dev.webhook_endpoints_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	environmentId: bigint("environment_id", { mode: "bigint" }).notNull(),
	connectorId: bigint("connector_id", { mode: "bigint" }),
	name: text().notNull(),
	verification: jsonb().default({"type":"hmac_sha256","header":"X-Signature"}).notNull(),
	signingSecretId: bigint("signing_secret_id", { mode: "bigint" }),
	eventTypePath: text("event_type_path"),
	dedupeKeyPath: text("dedupe_key_path"),
	status: text().default('active').notNull(),
	lastReceivedAt: timestamp("last_received_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("webhook_endpoints_conn_idx").using("btree", table.connectorId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("webhook_endpoints_env_idx").using("btree", table.environmentId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("webhook_endpoints_secret_idx").using("btree", table.signingSecretId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("webhook_endpoints_ws_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId, table.connectorId],
			foreignColumns: [connectorsInMcp.id, connectorsInMcp.organizationId],
			name: "webhook_endpoints_connector_id_organization_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.environmentId],
			foreignColumns: [environmentsInIam.id, environmentsInIam.organizationId],
			name: "webhook_endpoints_environment_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.signingSecretId],
			foreignColumns: [secretsInIam.id, secretsInIam.organizationId],
			name: "webhook_endpoints_signing_secret_id_organization_id_fkey"
		}),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "webhook_endpoints_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("webhook_endpoints_public_id_key").on(table.publicId),
	unique("webhook_endpoints_id_organization_id_key").on(table.id, table.organizationId),
	check("webhook_endpoints_status_check", sql`status = ANY (ARRAY['active'::text, 'paused'::text, 'disabled'::text])`),
]);

export const webhookSubscriptionsInDev = dev.table("webhook_subscriptions", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "dev.webhook_subscriptions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	environmentId: bigint("environment_id", { mode: "bigint" }),
	url: text().notNull(),
	description: text(),
	eventTypes: text("event_types").array().notNull(),
	signingSecretId: bigint("signing_secret_id", { mode: "bigint" }).notNull(),
	status: text().default('active').notNull(),
	consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
	disabledReason: text("disabled_reason"),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("webhook_subscriptions_creator_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	index("webhook_subscriptions_env_idx").using("btree", table.environmentId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("webhook_subscriptions_events_gin").using("gin", table.eventTypes.asc().nullsLast().op("array_ops")),
	index("webhook_subscriptions_secret_idx").using("btree", table.signingSecretId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("webhook_subscriptions_ws_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")).where(sql`(status = 'active'::text)`),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "webhook_subscriptions_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId, table.environmentId],
			foreignColumns: [environmentsInIam.id, environmentsInIam.organizationId],
			name: "webhook_subscriptions_environment_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.signingSecretId],
			foreignColumns: [secretsInIam.id, secretsInIam.organizationId],
			name: "webhook_subscriptions_signing_secret_id_organization_id_fkey"
		}),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "webhook_subscriptions_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("webhook_subscriptions_public_id_key").on(table.publicId),
	unique("webhook_subscriptions_id_organization_id_key").on(table.id, table.organizationId),
	check("webhook_subscriptions_status_check", sql`status = ANY (ARRAY['active'::text, 'paused'::text, 'disabled'::text])`),
	check("webhook_subscriptions_url_check", sql`url ~ '^https://'::text`),
]);

export const outboxEventsInDev = dev.table("outbox_events", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "dev.outbox_events_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	aggregateType: text("aggregate_type").notNull(),
	aggregateId: bigint("aggregate_id", { mode: "bigint" }).notNull(),
	eventType: text("event_type").notNull(),
	payload: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	attempts: smallint().default(0).notNull(),
	lastError: text("last_error"),
}, (table) => [
	index("outbox_events_aggregate_idx").using("btree", table.aggregateType.asc().nullsLast().op("text_ops"), table.aggregateId.asc().nullsLast().op("text_ops")),
	index("outbox_events_published_idx").using("btree", table.publishedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(published_at IS NOT NULL)`),
	index("outbox_events_unpublished_idx").using("btree", table.id.asc().nullsLast().op("int8_ops")).where(sql`(published_at IS NULL)`),
	unique("outbox_events_public_id_key").on(table.publicId),
]);

export const idempotencyKeysInDev = dev.table("idempotency_keys", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "dev.idempotency_keys_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	apiKeyId: bigint("api_key_id", { mode: "bigint" }),
	key: text().notNull(),
	requestMethod: text("request_method").notNull(),
	requestPath: text("request_path").notNull(),
	// customType: bytea
	requestHash: bytea("request_hash").notNull(),
	responseStatus: smallint("response_status"),
	responseBody: jsonb("response_body"),
	lockedUntil: timestamp("locked_until", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).default(sql`(now() + '24:00:00'::interval)`).notNull(),
}, (table) => [
	index("idempotency_keys_apikey_idx").using("btree", table.apiKeyId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("idempotency_keys_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.organizationId, table.apiKeyId],
			foreignColumns: [apiKeysInDev.id, apiKeysInDev.organizationId],
			name: "idempotency_keys_api_key_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "idempotency_keys_organization_id_fkey"
		}).onDelete("cascade"),
	unique("idempotency_keys_organization_id_key_key").on(table.key, table.organizationId),
]);

export const deviceAuthorizationsInDev = dev.table("device_authorizations", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "dev.device_authorizations_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// customType: bytea
	deviceCodeHash: bytea("device_code_hash").notNull(),
	userCode: text("user_code").notNull(),
	clientName: text("client_name").default('cli').notNull(),
	userId: bigint("user_id", { mode: "bigint" }),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	status: text().default('pending').notNull(),
	intervalS: smallint("interval_s").default(5).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("device_authorizations_code_uq").using("btree", table.userCode.asc().nullsLast().op("text_ops")).where(sql`(status = 'pending'::text)`),
	index("device_authorizations_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("device_authorizations_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "device_authorizations_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "device_authorizations_user_id_fkey"
		}).onDelete("cascade"),
	unique("device_authorizations_device_code_hash_key").on(table.deviceCodeHash),
	check("device_authorizations_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'expired'::text, 'consumed'::text])`),
]);

export const dailyRollupsInUsage = usage.table("daily_rollups", {
	day: date().notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	environmentId: bigint("environment_id", { mode: "bigint" }).notNull(),
	projectId: bigint("project_id", { mode: "bigint" }),
	sourceType: text("source_type").notNull(),
	agentId: bigint("agent_id", { mode: "bigint" }),
	capabilityId: bigint("capability_id", { mode: "bigint" }),
	apiKeyId: bigint("api_key_id", { mode: "bigint" }),
	modelId: bigint("model_id", { mode: "bigint" }),
	runsCount: integer("runs_count").default(0).notNull(),
	failedRunsCount: integer("failed_runs_count").default(0).notNull(),
	llmRequestsCount: integer("llm_requests_count").default(0).notNull(),
	toolCallsCount: integer("tool_calls_count").default(0).notNull(),
	inputTokens: bigint("input_tokens", { mode: "bigint" }).default(0).notNull(),
	outputTokens: bigint("output_tokens", { mode: "bigint" }).default(0).notNull(),
	tokensSaved: bigint("tokens_saved", { mode: "bigint" }).default(0).notNull(),
	providerCostUsd: numeric("provider_cost_usd", { precision: 18, scale:  6 }).default('0').notNull(),
	llmCreditsMicro: bigint("llm_credits_micro", { mode: "bigint" }).default(0).notNull(),
	infraCreditsMicro: bigint("infra_credits_micro", { mode: "bigint" }).default(0).notNull(),
	avgLatencyMs: integer("avg_latency_ms"),
	p95LatencyMs: integer("p95_latency_ms"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("daily_rollups_dims_uq").using("btree", table.day.asc().nullsLast().op("date_ops"), table.organizationId.asc().nullsLast().op("int8_ops"), table.workspaceId.asc().nullsLast().op("text_ops"), table.environmentId.asc().nullsLast().op("int8_ops"), table.projectId.asc().nullsLast().op("text_ops"), table.sourceType.asc().nullsLast().op("text_ops"), table.agentId.asc().nullsLast().op("date_ops"), table.capabilityId.asc().nullsLast().op("int8_ops"), table.apiKeyId.asc().nullsLast().op("text_ops"), table.modelId.asc().nullsLast().op("text_ops")),
	index("daily_rollups_model_idx").using("btree", table.modelId.asc().nullsLast().op("date_ops"), table.day.desc().nullsFirst().op("date_ops")),
	index("daily_rollups_org_day_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.day.desc().nullsFirst().op("int8_ops")),
	index("daily_rollups_ws_day_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.day.desc().nullsFirst().op("date_ops")),
]);

export const publishersInMarket = market.table("publishers", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "market.publishers_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	displayName: text("display_name").notNull(),
	// customType: citext
	slug: citext("slug").notNull(),
	bio: jsonb(),
	website: text(),
	logoFileId: bigint("logo_file_id", { mode: "bigint" }),
	level: text().default('community').notNull(),
	status: text().default('active').notNull(),
	payoutMethodId: bigint("payout_method_id", { mode: "bigint" }),
	payoutCurrency: char("payout_currency", { length: 3 }),
	agreementSignedAt: timestamp("agreement_signed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("publishers_currency_idx").using("btree", table.payoutCurrency.asc().nullsLast().op("bpchar_ops")),
	index("publishers_logo_idx").using("btree", table.logoFileId.asc().nullsLast().op("int8_ops")),
	index("publishers_payout_idx").using("btree", table.payoutMethodId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.logoFileId],
			foreignColumns: [filesInStorage.id],
			name: "publishers_logo_file_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "publishers_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.payoutCurrency],
			foreignColumns: [currenciesInRef.code],
			name: "publishers_payout_currency_fkey"
		}),
	foreignKey({
			columns: [table.payoutMethodId],
			foreignColumns: [paymentMethodsInBilling.id],
			name: "publishers_payout_method_id_fkey"
		}).onDelete("set null"),
	unique("publishers_public_id_key").on(table.publicId),
	unique("publishers_organization_id_key").on(table.organizationId),
	unique("publishers_slug_key").on(table.slug),
	check("publishers_level_check", sql`level = ANY (ARRAY['community'::text, 'verified'::text, 'premium_certified'::text, 'official'::text])`),
	check("publishers_slug_check", sql`slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'::citext`),
	check("publishers_status_check", sql`status = ANY (ARRAY['active'::text, 'suspended'::text, 'banned'::text])`),
]);

export const listingsInMarket = market.table("listings", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "market.listings_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	publisherId: bigint("publisher_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	type: text().notNull(),
	deliveryMode: text("delivery_mode").default('sealed').notNull(),
	// customType: citext
	slug: citext("slug").notNull(),
	name: jsonb().notNull(),
	summary: jsonb().notNull(),
	description: jsonb(),
	categoryId: bigint("category_id", { mode: "bigint" }),
	tags: text().array().default([""]).notNull(),
	trustLevel: text("trust_level").default('community').notNull(),
	status: text().default('draft').notNull(),
	pricingModel: text("pricing_model").default('free').notNull(),
	currentVersionId: bigint("current_version_id", { mode: "bigint" }),
	requirements: jsonb().default({}).notNull(),
	declaredPermissions: jsonb("declared_permissions").default({}).notNull(),
	sourceCodeUrl: text("source_code_url"),
	iconFileId: bigint("icon_file_id", { mode: "bigint" }),
	installCount: integer("install_count").default(0).notNull(),
	ratingAvg: numeric("rating_avg", { precision: 3, scale:  2 }),
	ratingCount: integer("rating_count").default(0).notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	// TODO: failed to parse database type 'tsvector'
	searchTsv: text("search_tsv").generatedAlwaysAs(sql`(setweight(to_tsvector('simple'::regconfig, ((COALESCE((name ->> 'fr'::text), ''::text) || ' '::text) || COALESCE((name ->> 'en'::text), ''::text))), 'A'::"char") || setweight(to_tsvector('simple'::regconfig, ((COALESCE((summary ->> 'fr'::text), ''::text) || ' '::text) || COALESCE((summary ->> 'en'::text), ''::text))), 'B'::"char"))`),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("listings_browse_idx").using("btree", table.type.asc().nullsLast().op("text_ops"), table.trustLevel.asc().nullsLast().op("int4_ops"), table.installCount.desc().nullsFirst().op("text_ops")).where(sql`(status = 'published'::text)`),
	index("listings_category_idx").using("btree", table.categoryId.asc().nullsLast().op("int8_ops")),
	index("listings_icon_idx").using("btree", table.iconFileId.asc().nullsLast().op("int8_ops")),
	index("listings_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("listings_publisher_idx").using("btree", table.publisherId.asc().nullsLast().op("int8_ops")),
	index("listings_review_idx").using("btree", table.updatedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = 'in_review'::text)`),
	index("listings_search_gin").using("gin", table.searchTsv.asc().nullsLast().op("tsvector_ops")),
	index("listings_tags_gin").using("gin", table.tags.asc().nullsLast().op("array_ops")),
	index("listings_version_idx").using("btree", table.currentVersionId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categoriesInMarket.id],
			name: "listings_category_id_fkey"
		}),
	foreignKey({
			columns: [table.currentVersionId],
			foreignColumns: [listingVersionsInMarket.id],
			name: "listings_current_version_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.iconFileId],
			foreignColumns: [filesInStorage.id],
			name: "listings_icon_file_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "listings_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.publisherId],
			foreignColumns: [publishersInMarket.id],
			name: "listings_publisher_id_fkey"
		}),
	unique("listings_public_id_key").on(table.publicId),
	unique("listings_slug_key").on(table.slug),
	check("listings_check", sql`(trust_level <> 'community'::text) OR (source_code_url IS NOT NULL) OR (status = 'draft'::text)`),
	check("listings_check1", sql`(pricing_model = 'free'::text) OR (trust_level = ANY (ARRAY['premium'::text, 'official'::text]))`),
	check("listings_delivery_mode_check", sql`delivery_mode = ANY (ARRAY['sealed'::text, 'copy'::text])`),
	check("listings_name_check", sql`CHECK (util.is_i18n(name`),
	check("listings_pricing_model_check", sql`pricing_model = ANY (ARRAY['free'::text, 'one_time'::text, 'monthly'::text, 'usage_based'::text, 'freemium'::text])`),
	check("listings_slug_check", sql`slug ~ '^[a-z0-9]([a-z0-9-]{0,98}[a-z0-9])?$'::citext`),
	check("listings_status_check", sql`status = ANY (ARRAY['draft'::text, 'in_review'::text, 'published'::text, 'suspended'::text, 'removed'::text])`),
	check("listings_summary_check", sql`CHECK (util.is_i18n(summary`),
	check("listings_trust_level_check", sql`trust_level = ANY (ARRAY['community'::text, 'verified'::text, 'official'::text, 'premium'::text])`),
	check("listings_type_check", sql`type = ANY (ARRAY['mcp_server'::text, 'agent_template'::text, 'prompt_template'::text, 'capability'::text, 'bundle'::text])`),
]);

export const entitlementsInMarket = market.table("entitlements", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "market.entitlements_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	listingId: bigint("listing_id", { mode: "bigint" }).notNull(),
	kind: text().notNull(),
	status: text().default('active').notNull(),
	invoiceLineId: bigint("invoice_line_id", { mode: "bigint" }),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("entitlements_active_uq").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.listingId.asc().nullsLast().op("int8_ops")).where(sql`(status = 'active'::text)`),
	index("entitlements_line_idx").using("btree", table.invoiceLineId.asc().nullsLast().op("int8_ops")),
	index("entitlements_listing_idx").using("btree", table.listingId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.invoiceLineId],
			foreignColumns: [invoiceLinesInBilling.id],
			name: "entitlements_invoice_line_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.listingId],
			foreignColumns: [listingsInMarket.id],
			name: "entitlements_listing_id_fkey"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "entitlements_organization_id_fkey"
		}).onDelete("cascade"),
	unique("entitlements_public_id_key").on(table.publicId),
	check("entitlements_kind_check", sql`kind = ANY (ARRAY['free'::text, 'one_time'::text, 'subscription'::text, 'usage'::text])`),
	check("entitlements_status_check", sql`status = ANY (ARRAY['active'::text, 'past_due'::text, 'cancelled'::text, 'expired'::text, 'refunded'::text])`),
]);

export const installationsInMarket = market.table("installations", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "market.installations_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	listingId: bigint("listing_id", { mode: "bigint" }).notNull(),
	listingVersionId: bigint("listing_version_id", { mode: "bigint" }).notNull(),
	entitlementId: bigint("entitlement_id", { mode: "bigint" }),
	updatePolicy: text("update_policy").default('notify').notNull(),
	status: text().default('active').notNull(),
	installedResources: jsonb("installed_resources").default([]).notNull(),
	installedByUserId: bigint("installed_by_user_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	uninstalledAt: timestamp("uninstalled_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("installations_ent_idx").using("btree", table.entitlementId.asc().nullsLast().op("int8_ops")),
	index("installations_listing_idx").using("btree", table.listingId.asc().nullsLast().op("int8_ops")),
	index("installations_user_idx").using("btree", table.installedByUserId.asc().nullsLast().op("int8_ops")),
	index("installations_version_idx").using("btree", table.listingVersionId.asc().nullsLast().op("int8_ops")),
	index("installations_ws_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.entitlementId],
			foreignColumns: [entitlementsInMarket.id],
			name: "installations_entitlement_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.installedByUserId],
			foreignColumns: [usersInIam.id],
			name: "installations_installed_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.listingId],
			foreignColumns: [listingsInMarket.id],
			name: "installations_listing_id_fkey"
		}),
	foreignKey({
			columns: [table.listingVersionId],
			foreignColumns: [listingVersionsInMarket.id],
			name: "installations_listing_version_id_fkey"
		}),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "installations_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("installations_public_id_key").on(table.publicId),
	check("installations_status_check", sql`status = ANY (ARRAY['installing'::text, 'active'::text, 'needs_config'::text, 'uninstalled'::text, 'failed'::text])`),
	check("installations_update_policy_check", sql`update_policy = ANY (ARRAY['manual'::text, 'notify'::text])`),
]);

export const reviewsInMarket = market.table("reviews", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "market.reviews_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	listingId: bigint("listing_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	userId: bigint("user_id", { mode: "bigint" }),
	rating: smallint().notNull(),
	comment: text(),
	status: text().default('published').notNull(),
	publisherReply: text("publisher_reply"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("reviews_listing_idx").using("btree", table.listingId.asc().nullsLast().op("int8_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(status = 'published'::text)`),
	index("reviews_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("reviews_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.listingId],
			foreignColumns: [listingsInMarket.id],
			name: "reviews_listing_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "reviews_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "reviews_user_id_fkey"
		}).onDelete("set null"),
	unique("reviews_public_id_key").on(table.publicId),
	unique("reviews_listing_id_organization_id_key").on(table.listingId, table.organizationId),
	check("reviews_rating_check", sql`(rating >= 1) AND (rating <= 5)`),
	check("reviews_status_check", sql`status = ANY (ARRAY['published'::text, 'hidden'::text, 'removed'::text])`),
]);

export const legalAcceptancesInCompliance = compliance.table("legal_acceptances", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "compliance.legal_acceptances_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: bigint("user_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	documentId: bigint("document_id", { mode: "bigint" }).notNull(),
	acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	ip: inet(),
	userAgent: text("user_agent"),
}, (table) => [
	index("legal_acceptances_doc_idx").using("btree", table.documentId.asc().nullsLast().op("int8_ops")),
	index("legal_acceptances_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [legalDocumentsInCompliance.id],
			name: "legal_acceptances_document_id_fkey"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "legal_acceptances_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "legal_acceptances_user_id_fkey"
		}).onDelete("cascade"),
	unique("legal_acceptances_user_id_document_id_organization_id_key").on(table.documentId, table.organizationId, table.userId),
]);

export const dataSubjectRequestsInCompliance = compliance.table("data_subject_requests", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "compliance.data_subject_requests_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	userId: bigint("user_id", { mode: "bigint" }),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	// customType: citext
	requesterEmail: citext("requester_email").notNull(),
	kind: text().notNull(),
	status: text().default('received').notNull(),
	dueAt: timestamp("due_at", { withTimezone: true, mode: 'string' }).notNull(),
	exportFileId: bigint("export_file_id", { mode: "bigint" }),
	handledByStaffId: bigint("handled_by_staff_id", { mode: "bigint" }),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("dsr_file_idx").using("btree", table.exportFileId.asc().nullsLast().op("int8_ops")),
	index("dsr_open_idx").using("btree", table.dueAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status <> ALL (ARRAY['completed'::text, 'rejected'::text]))`),
	index("dsr_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("dsr_staff_idx").using("btree", table.handledByStaffId.asc().nullsLast().op("int8_ops")),
	index("dsr_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.exportFileId],
			foreignColumns: [filesInStorage.id],
			name: "data_subject_requests_export_file_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.handledByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "data_subject_requests_handled_by_staff_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "data_subject_requests_organization_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "data_subject_requests_user_id_fkey"
		}).onDelete("set null"),
	unique("data_subject_requests_public_id_key").on(table.publicId),
	check("data_subject_requests_kind_check", sql`kind = ANY (ARRAY['access'::text, 'export'::text, 'rectification'::text, 'deletion'::text, 'objection'::text, 'portability'::text])`),
	check("data_subject_requests_status_check", sql`status = ANY (ARRAY['received'::text, 'verifying'::text, 'in_progress'::text, 'completed'::text, 'rejected'::text])`),
]);

export const guardrailProfilesInAi = ai.table("guardrail_profiles", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.guardrail_profiles_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	key: text().notNull(),
	name: jsonb().notNull(),
	description: jsonb(),
	mode: text().default('enforce').notNull(),
	isSystem: boolean("is_system").default(false).notNull(),
	lockVersion: integer("lock_version").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("guardrail_profiles_key_uq").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.key.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "guardrail_profiles_organization_id_fkey"
		}).onDelete("cascade"),
	unique("guardrail_profiles_public_id_key").on(table.publicId),
	unique("guardrail_profiles_id_organization_id_key").on(table.id, table.organizationId),
	check("guardrail_profiles_check", sql`is_system = (organization_id IS NULL)`),
	check("guardrail_profiles_key_check", sql`key ~ '^[a-z0-9_]+$'::text`),
	check("guardrail_profiles_mode_check", sql`mode = ANY (ARRAY['enforce'::text, 'monitor'::text])`),
	check("guardrail_profiles_name_check", sql`CHECK (util.is_i18n(name`),
]);

export const guardrailRulesInAi = ai.table("guardrail_rules", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.guardrail_rules_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	profileId: bigint("profile_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	detectorId: bigint("detector_id", { mode: "bigint" }).notNull(),
	position: smallint().default(0).notNull(),
	action: text().notNull(),
	threshold: numeric({ precision: 5, scale:  4 }),
	params: jsonb().default({}).notNull(),
	appliesTo: text("applies_to").array().default(["sdk", "chat", "agent", "mcp_external", "playground"]).notNull(),
	sampleRate: numeric("sample_rate", { precision: 5, scale:  4 }).default('1').notNull(),
	isEnabled: boolean("is_enabled").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("guardrail_rules_detector_idx").using("btree", table.detectorId.asc().nullsLast().op("int8_ops")),
	index("guardrail_rules_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("guardrail_rules_profile_idx").using("btree", table.profileId.asc().nullsLast().op("int2_ops"), table.position.asc().nullsLast().op("int2_ops")).where(sql`is_enabled`),
	foreignKey({
			columns: [table.detectorId],
			foreignColumns: [guardrailDetectorsInAi.id],
			name: "guardrail_rules_detector_id_fkey"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "guardrail_rules_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [guardrailProfilesInAi.id],
			name: "guardrail_rules_profile_id_fkey"
		}).onDelete("cascade"),
	unique("guardrail_rules_profile_id_detector_id_position_key").on(table.detectorId, table.position, table.profileId),
	check("guardrail_rules_action_check", sql`action = ANY (ARRAY['block'::text, 'redact'::text, 'flag'::text, 'require_approval'::text, 'fallback_model'::text, 'retry'::text, 'escalate_judge'::text])`),
	check("guardrail_rules_sample_rate_check", sql`(sample_rate > (0)::numeric) AND (sample_rate <= (1)::numeric)`),
	check("guardrail_rules_threshold_check", sql`(threshold >= (0)::numeric) AND (threshold <= (1)::numeric)`),
]);

export const guardrailBindingsInAi = ai.table("guardrail_bindings", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ai.guardrail_bindings_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	profileId: bigint("profile_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	scopeType: text("scope_type").notNull(),
	scopeId: bigint("scope_id", { mode: "bigint" }),
	priority: smallint().default(100).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("guardrail_bindings_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.scopeType.asc().nullsLast().op("text_ops"), table.scopeId.asc().nullsLast().op("text_ops")),
	index("guardrail_bindings_profile_idx").using("btree", table.profileId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("guardrail_bindings_uq").using("btree", table.scopeType.asc().nullsLast().op("int8_ops"), table.scopeId.asc().nullsLast().op("text_ops"), table.profileId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "guardrail_bindings_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [guardrailProfilesInAi.id],
			name: "guardrail_bindings_profile_id_fkey"
		}).onDelete("cascade"),
	check("guardrail_bindings_check", sql`(scope_type = 'global'::text) = (scope_id IS NULL)`),
	check("guardrail_bindings_check1", sql`(scope_type = ANY (ARRAY['global'::text, 'plan'::text])) OR (organization_id IS NOT NULL)`),
	check("guardrail_bindings_scope_type_check", sql`scope_type = ANY (ARRAY['global'::text, 'plan'::text, 'organization'::text, 'workspace'::text, 'environment'::text, 'capability'::text, 'agent'::text, 'mcp_server'::text])`),
]);

export const organizationsInIam = iam.table("organizations", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam.organizations_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	name: text().notNull(),
	// customType: citext
	slug: citext("slug").notNull(),
	kind: text().default('company').notNull(),
	legalName: text("legal_name"),
	taxId: text("tax_id"),
	// customType: citext
	billingEmail: citext("billing_email"),
	billingAddress: jsonb("billing_address"),
	countryCode: char("country_code", { length: 2 }).notNull(),
	defaultCurrency: char("default_currency", { length: 3 }).notNull(),
	defaultLocale: text("default_locale").notNull(),
	dataRegionId: bigint("data_region_id", { mode: "bigint" }).notNull(),
	status: text().default('active').notNull(),
	suspendedReason: text("suspended_reason"),
	deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true, mode: 'string' }),
	deletionScheduledAt: timestamp("deletion_scheduled_at", { withTimezone: true, mode: 'string' }),
	isInternal: boolean("is_internal").default(false).notNull(),
	settings: jsonb().default({}).notNull(),
	createdByUserId: bigint("created_by_user_id", { mode: "bigint" }),
	lockVersion: integer("lock_version").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	defaultRoutingProfileId: bigint("default_routing_profile_id", { mode: "bigint" }),
}, (table) => [
	index("organizations_country_idx").using("btree", table.countryCode.asc().nullsLast().op("bpchar_ops")),
	index("organizations_created_by_idx").using("btree", table.createdByUserId.asc().nullsLast().op("int8_ops")),
	index("organizations_currency_idx").using("btree", table.defaultCurrency.asc().nullsLast().op("bpchar_ops")),
	index("organizations_deletion_idx").using("btree", table.deletionScheduledAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = 'pending_deletion'::text)`),
	index("organizations_locale_idx").using("btree", table.defaultLocale.asc().nullsLast().op("text_ops")),
	index("organizations_name_trgm").using("gin", table.name.asc().nullsLast().op("gin_trgm_ops")),
	index("organizations_region_idx").using("btree", table.dataRegionId.asc().nullsLast().op("int8_ops")),
	index("organizations_routing_profile_idx").using("btree", table.defaultRoutingProfileId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("organizations_slug_uq").using("btree", table.slug.asc().nullsLast().op("citext_ops")).where(sql`(deleted_at IS NULL)`),
	index("organizations_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")).where(sql`(status <> 'active'::text)`),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countriesInRef.code],
			name: "organizations_country_code_fkey"
		}),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [usersInIam.id],
			name: "organizations_created_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.dataRegionId],
			foreignColumns: [dataRegionsInRef.id],
			name: "organizations_data_region_id_fkey"
		}),
	foreignKey({
			columns: [table.defaultCurrency],
			foreignColumns: [currenciesInRef.code],
			name: "organizations_default_currency_fkey"
		}),
	foreignKey({
			columns: [table.defaultLocale],
			foreignColumns: [languagesInRef.code],
			name: "organizations_default_locale_fkey"
		}),
	foreignKey({
			columns: [table.defaultRoutingProfileId],
			foreignColumns: [routingProfilesInAi.id],
			name: "organizations_default_routing_profile_id_fkey"
		}),
	unique("organizations_public_id_key").on(table.publicId),
	check("organizations_kind_check", sql`kind = ANY (ARRAY['individual'::text, 'company'::text])`),
	check("organizations_slug_check", sql`slug ~ '^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$'::citext`),
	check("organizations_status_check", sql`status = ANY (ARRAY['active'::text, 'suspended'::text, 'pending_deletion'::text, 'deleted'::text])`),
]);

export const listingVersionsInMarket = market.table("listing_versions", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "market.listing_versions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	listingId: bigint("listing_id", { mode: "bigint" }).notNull(),
	semver: text().notNull(),
	package: jsonb().notNull(),
	changelog: text(),
	scanStatus: text("scan_status").default('pending').notNull(),
	scanReport: jsonb("scan_report").default({}).notNull(),
	reviewStatus: text("review_status").default('not_required').notNull(),
	reviewedByStaffId: bigint("reviewed_by_staff_id", { mode: "bigint" }),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("listing_versions_listing_idx").using("btree", table.listingId.asc().nullsLast().op("timestamptz_ops"), table.submittedAt.desc().nullsFirst().op("int8_ops")),
	index("listing_versions_queue_idx").using("btree", table.submittedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(review_status = 'pending'::text)`),
	index("listing_versions_staff_idx").using("btree", table.reviewedByStaffId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.listingId],
			foreignColumns: [listingsInMarket.id],
			name: "listing_versions_listing_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.reviewedByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "listing_versions_staff_fk"
		}).onDelete("set null"),
	unique("listing_versions_public_id_key").on(table.publicId),
	unique("listing_versions_listing_id_semver_key").on(table.listingId, table.semver),
	check("listing_versions_review_status_check", sql`review_status = ANY (ARRAY['not_required'::text, 'pending'::text, 'approved'::text, 'changes_requested'::text, 'rejected'::text])`),
	check("listing_versions_scan_status_check", sql`scan_status = ANY (ARRAY['pending'::text, 'passed'::text, 'failed'::text])`),
	check("listing_versions_semver_check", sql`semver ~ '^[0-9]+\.[0-9]+\.[0-9]+$'::text`),
]);

export const listingPricesInMarket = market.table("listing_prices", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "market.listing_prices_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	listingId: bigint("listing_id", { mode: "bigint" }).notNull(),
	currency: char({ length: 3 }).notNull(),
	amountMinor: bigint("amount_minor", { mode: "bigint" }),
	usagePct: numeric("usage_pct", { precision: 5, scale:  4 }),
	// customType: tstzrange
	effectiveDuring: tstzrange("effective_during").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("listing_prices_currency_idx").using("btree", table.currency.asc().nullsLast().op("bpchar_ops")),
	foreignKey({
			columns: [table.currency],
			foreignColumns: [currenciesInRef.code],
			name: "listing_prices_currency_fkey"
		}),
	foreignKey({
			columns: [table.listingId],
			foreignColumns: [listingsInMarket.id],
			name: "listing_prices_listing_id_fkey"
		}).onDelete("cascade"),
	check("listing_prices_amount_minor_check", sql`amount_minor >= 0`),
	check("listing_prices_check", sql`(amount_minor IS NOT NULL) OR (usage_pct IS NOT NULL)`),
	check("listing_prices_usage_pct_check", sql`(usage_pct > (0)::numeric) AND (usage_pct < (1)::numeric)`),
]);

export const userPreferencesInUx = ux.table("user_preferences", {
	userId: bigint("user_id", { mode: "bigint" }).primaryKey().notNull(),
	theme: text().default('system').notNull(),
	displayCurrency: char("display_currency", { length: 3 }),
	dateFormat: text("date_format"),
	numberFormat: text("number_format"),
	defaultOrgId: bigint("default_org_id", { mode: "bigint" }),
	defaultWorkspaceId: bigint("default_workspace_id", { mode: "bigint" }),
	sidebarCollapsed: boolean("sidebar_collapsed").default(false).notNull(),
	density: text().default('comfortable').notNull(),
	technicalMode: boolean("technical_mode").default(false).notNull(),
	extra: jsonb().default({}).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("user_preferences_currency_idx").using("btree", table.displayCurrency.asc().nullsLast().op("bpchar_ops")),
	index("user_preferences_org_idx").using("btree", table.defaultOrgId.asc().nullsLast().op("int8_ops")),
	index("user_preferences_ws_idx").using("btree", table.defaultWorkspaceId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.defaultOrgId],
			foreignColumns: [organizationsInIam.id],
			name: "user_preferences_default_org_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.defaultWorkspaceId],
			foreignColumns: [workspacesInIam.id],
			name: "user_preferences_default_workspace_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.displayCurrency],
			foreignColumns: [currenciesInRef.code],
			name: "user_preferences_display_currency_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "user_preferences_user_id_fkey"
		}).onDelete("cascade"),
	check("user_preferences_density_check", sql`density = ANY (ARRAY['compact'::text, 'comfortable'::text])`),
	check("user_preferences_theme_check", sql`theme = ANY (ARRAY['light'::text, 'dark'::text, 'system'::text])`),
]);

export const uiStatesInUx = ux.table("ui_states", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ux.ui_states_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: bigint("user_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	key: text().notNull(),
	value: jsonb().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ui_states_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("ui_states_uq").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.organizationId.asc().nullsLast().op("int8_ops"), table.key.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "ui_states_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "ui_states_user_id_fkey"
		}).onDelete("cascade"),
	check("ui_states_key_check", sql`length(key) <= 200`),
]);

export const onboardingProgressInUx = ux.table("onboarding_progress", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ux.onboarding_progress_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: bigint("user_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	flowKey: text("flow_key").notNull(),
	profile: text(),
	currentStep: text("current_step"),
	completedSteps: text("completed_steps").array().default([""]).notNull(),
	data: jsonb().default({}).notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	dismissedAt: timestamp("dismissed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("onboarding_progress_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("onboarding_progress_uq").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.organizationId.asc().nullsLast().op("int8_ops"), table.flowKey.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "onboarding_progress_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "onboarding_progress_user_id_fkey"
		}).onDelete("cascade"),
	check("onboarding_progress_profile_check", sql`profile = ANY (ARRAY['activity'::text, 'builder'::text, 'enterprise'::text])`),
]);

export const draftsInUx = ux.table("drafts", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ux.drafts_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }),
	userId: bigint("user_id", { mode: "bigint" }).notNull(),
	resourceType: text("resource_type").notNull(),
	resourceId: bigint("resource_id", { mode: "bigint" }),
	wizardStep: text("wizard_step"),
	data: jsonb().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).default(sql`(now() + '30 days'::interval)`).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("drafts_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("drafts_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("drafts_user_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.organizationId.asc().nullsLast().op("int8_ops"), table.updatedAt.desc().nullsFirst().op("int8_ops")),
	index("drafts_ws_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "drafts_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "drafts_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("drafts_public_id_key").on(table.publicId),
	check("drafts_resource_type_check", sql`resource_type = ANY (ARRAY['connector'::text, 'mcp_server'::text, 'agent'::text, 'capability'::text, 'listing'::text, 'budget'::text, 'policy'::text, 'other'::text])`),
]);

export const savedViewsInUx = ux.table("saved_views", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ux.saved_views_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	userId: bigint("user_id", { mode: "bigint" }).notNull(),
	resource: text().notNull(),
	name: text().notNull(),
	filters: jsonb().default({}).notNull(),
	sort: jsonb().default([]).notNull(),
	columns: jsonb().default([]).notNull(),
	isShared: boolean("is_shared").default(false).notNull(),
	isDefault: boolean("is_default").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("saved_views_default_uq").using("btree", table.userId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("text_ops"), table.resource.asc().nullsLast().op("text_ops")).where(sql`is_default`),
	index("saved_views_shared_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops"), table.resource.asc().nullsLast().op("int8_ops")).where(sql`is_shared`),
	index("saved_views_user_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.resource.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "saved_views_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "saved_views_user_id_fkey"
		}).onDelete("cascade"),
	unique("saved_views_public_id_key").on(table.publicId),
]);

export const dashboardsInUx = ux.table("dashboards", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "ux.dashboards_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	workspaceId: bigint("workspace_id", { mode: "bigint" }),
	ownerUserId: bigint("owner_user_id", { mode: "bigint" }).notNull(),
	name: text().notNull(),
	layout: jsonb().default([]).notNull(),
	widgets: jsonb().default([]).notNull(),
	isShared: boolean("is_shared").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("dashboards_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")).where(sql`is_shared`),
	index("dashboards_owner_idx").using("btree", table.ownerUserId.asc().nullsLast().op("int8_ops")),
	index("dashboards_ws_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "dashboards_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.ownerUserId],
			foreignColumns: [usersInIam.id],
			name: "dashboards_owner_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.workspaceId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "dashboards_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	unique("dashboards_public_id_key").on(table.publicId),
]);

export const notificationsInNotif = notif.table("notifications", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "notif.notifications_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	userId: bigint("user_id", { mode: "bigint" }).notNull(),
	type: text().notNull(),
	category: text().notNull(),
	severity: text().default('info').notNull(),
	title: text().notNull(),
	body: text(),
	params: jsonb().default({}).notNull(),
	actionUrl: text("action_url"),
	resourceType: text("resource_type"),
	resourcePublicId: uuid("resource_public_id"),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	archivedAt: timestamp("archived_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("notifications_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("notifications_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops"), table.createdAt.desc().nullsFirst().op("int8_ops")),
	index("notifications_user_unread_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((read_at IS NULL) AND (archived_at IS NULL))`),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "notifications_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "notifications_user_id_fkey"
		}).onDelete("cascade"),
	unique("notifications_public_id_key").on(table.publicId),
	check("notifications_category_check", sql`category = ANY (ARRAY['billing'::text, 'usage'::text, 'agents'::text, 'mcp'::text, 'security'::text, 'marketplace'::text, 'team'::text, 'system'::text])`),
	check("notifications_severity_check", sql`severity = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'critical'::text])`),
]);

export const preferencesInNotif = notif.table("preferences", {
	userId: bigint("user_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	category: text().notNull(),
	channel: text().notNull(),
	enabled: boolean().default(true).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("notif_preferences_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("notif_preferences_uq").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.organizationId.asc().nullsLast().op("text_ops"), table.category.asc().nullsLast().op("int8_ops"), table.channel.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "preferences_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "preferences_user_id_fkey"
		}).onDelete("cascade"),
	check("preferences_channel_check", sql`channel = ANY (ARRAY['in_app'::text, 'email'::text, 'sms'::text, 'whatsapp'::text, 'webhook'::text, 'push'::text])`),
]);

export const deliveriesInNotif = notif.table("deliveries", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "notif.deliveries_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	notificationId: bigint("notification_id", { mode: "bigint" }),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	channel: text().notNull(),
	recipient: text().notNull(),
	templateKey: text("template_key").notNull(),
	locale: text().notNull(),
	status: text().default('queued').notNull(),
	provider: text(),
	providerMessageId: text("provider_message_id"),
	error: text(),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("deliveries_locale_idx").using("btree", table.locale.asc().nullsLast().op("text_ops")),
	index("deliveries_notification_idx").using("btree", table.notificationId.asc().nullsLast().op("int8_ops")),
	index("deliveries_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops"), table.createdAt.desc().nullsFirst().op("int8_ops")),
	index("deliveries_provider_msg_idx").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.providerMessageId.asc().nullsLast().op("text_ops")),
	index("deliveries_queue_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = 'queued'::text)`),
	foreignKey({
			columns: [table.locale],
			foreignColumns: [languagesInRef.code],
			name: "deliveries_locale_fkey"
		}),
	foreignKey({
			columns: [table.notificationId],
			foreignColumns: [notificationsInNotif.id],
			name: "deliveries_notification_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "deliveries_organization_id_fkey"
		}).onDelete("cascade"),
	check("deliveries_channel_check", sql`channel = ANY (ARRAY['email'::text, 'sms'::text, 'whatsapp'::text, 'push'::text])`),
	check("deliveries_status_check", sql`status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'bounced'::text, 'failed'::text])`),
]);

export const supportTicketsInPlatform = platform.table("support_tickets", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.support_tickets_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	number: bigint({ mode: "bigint" }).default(sql`nextval('platform.support_ticket_number_seq'::regclass)`).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	userId: bigint("user_id", { mode: "bigint" }),
	// customType: citext
	contactEmail: citext("contact_email"),
	subject: text().notNull(),
	category: text().notNull(),
	priority: text().default('normal').notNull(),
	status: text().default('open').notNull(),
	channel: text().default('web').notNull(),
	assignedStaffId: bigint("assigned_staff_id", { mode: "bigint" }),
	slaDueAt: timestamp("sla_due_at", { withTimezone: true, mode: 'string' }),
	firstResponseAt: timestamp("first_response_at", { withTimezone: true, mode: 'string' }),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	satisfaction: smallint(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("support_tickets_org_idx").using("btree", table.organizationId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("int8_ops")),
	index("support_tickets_queue_idx").using("btree", table.status.asc().nullsLast().op("timestamptz_ops"), table.priority.asc().nullsLast().op("text_ops"), table.slaDueAt.asc().nullsLast().op("text_ops")).where(sql`(status <> ALL (ARRAY['resolved'::text, 'closed'::text]))`),
	index("support_tickets_staff_idx").using("btree", table.assignedStaffId.asc().nullsLast().op("int8_ops")),
	index("support_tickets_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.assignedStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "support_tickets_assigned_staff_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "support_tickets_organization_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "support_tickets_user_id_fkey"
		}).onDelete("set null"),
	unique("support_tickets_public_id_key").on(table.publicId),
	unique("support_tickets_number_key").on(table.number),
	check("support_tickets_category_check", sql`category = ANY (ARRAY['billing'::text, 'technical'::text, 'account'::text, 'mcp'::text, 'agents'::text, 'marketplace'::text, 'security'::text, 'other'::text])`),
	check("support_tickets_channel_check", sql`channel = ANY (ARRAY['web'::text, 'email'::text, 'chat'::text, 'whatsapp'::text, 'phone'::text])`),
	check("support_tickets_priority_check", sql`priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])`),
	check("support_tickets_satisfaction_check", sql`(satisfaction >= 1) AND (satisfaction <= 5)`),
	check("support_tickets_status_check", sql`status = ANY (ARRAY['open'::text, 'pending_customer'::text, 'pending_internal'::text, 'resolved'::text, 'closed'::text])`),
]);

export const supportMessagesInPlatform = platform.table("support_messages", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.support_messages_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	ticketId: bigint("ticket_id", { mode: "bigint" }).notNull(),
	authorType: text("author_type").notNull(),
	userId: bigint("user_id", { mode: "bigint" }),
	staffUserId: bigint("staff_user_id", { mode: "bigint" }),
	body: text().notNull(),
	isInternal: boolean("is_internal").default(false).notNull(),
	attachmentIds: bigint("attachment_ids", { mode: "bigint" }).array().default([]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("support_messages_staff_idx").using("btree", table.staffUserId.asc().nullsLast().op("int8_ops")),
	index("support_messages_ticket_idx").using("btree", table.ticketId.asc().nullsLast().op("int8_ops"), table.createdAt.asc().nullsLast().op("int8_ops")),
	index("support_messages_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.staffUserId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "support_messages_staff_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.ticketId],
			foreignColumns: [supportTicketsInPlatform.id],
			name: "support_messages_ticket_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "support_messages_user_id_fkey"
		}).onDelete("set null"),
	check("support_messages_author_type_check", sql`author_type = ANY (ARRAY['user'::text, 'staff'::text, 'system'::text])`),
]);

export const moderationReportsInPlatform = platform.table("moderation_reports", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.moderation_reports_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	publicId: uuid("public_id").default(sql`uuidv7()`).notNull(),
	targetType: text("target_type").notNull(),
	targetId: bigint("target_id", { mode: "bigint" }).notNull(),
	reporterUserId: bigint("reporter_user_id", { mode: "bigint" }),
	reporterOrgId: bigint("reporter_org_id", { mode: "bigint" }),
	reason: text().notNull(),
	details: text(),
	severity: text().default('normal').notNull(),
	status: text().default('open').notNull(),
	resolvedByStaffId: bigint("resolved_by_staff_id", { mode: "bigint" }),
	resolution: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("moderation_reports_org_idx").using("btree", table.reporterOrgId.asc().nullsLast().op("int8_ops")),
	index("moderation_reports_queue_idx").using("btree", table.severity.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")).where(sql`(status = ANY (ARRAY['open'::text, 'in_review'::text]))`),
	index("moderation_reports_staff_idx").using("btree", table.resolvedByStaffId.asc().nullsLast().op("int8_ops")),
	index("moderation_reports_target_idx").using("btree", table.targetType.asc().nullsLast().op("int8_ops"), table.targetId.asc().nullsLast().op("int8_ops")),
	index("moderation_reports_user_idx").using("btree", table.reporterUserId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.reporterOrgId],
			foreignColumns: [organizationsInIam.id],
			name: "moderation_reports_reporter_org_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.reporterUserId],
			foreignColumns: [usersInIam.id],
			name: "moderation_reports_reporter_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.resolvedByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "moderation_reports_resolved_by_staff_id_fkey"
		}).onDelete("set null"),
	unique("moderation_reports_public_id_key").on(table.publicId),
	check("moderation_reports_reason_check", sql`reason = ANY (ARRAY['security'::text, 'misleading'::text, 'unexpected_behavior'::text, 'abuse'::text, 'copyright'::text, 'other'::text])`),
	check("moderation_reports_severity_check", sql`severity = ANY (ARRAY['normal'::text, 'high'::text, 'security'::text])`),
	check("moderation_reports_status_check", sql`status = ANY (ARRAY['open'::text, 'in_review'::text, 'resolved'::text, 'dismissed'::text])`),
	check("moderation_reports_target_type_check", sql`target_type = ANY (ARRAY['listing'::text, 'publisher'::text, 'mcp_server'::text, 'organization'::text, 'review'::text])`),
]);

export const abuseSignalsInPlatform = platform.table("abuse_signals", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity({ name: "platform.abuse_signals_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	organizationId: bigint("organization_id", { mode: "bigint" }),
	userId: bigint("user_id", { mode: "bigint" }),
	kind: text().notNull(),
	score: numeric({ precision: 5, scale:  2 }).notNull(),
	details: jsonb().default({}).notNull(),
	status: text().default('open').notNull(),
	reviewedByStaffId: bigint("reviewed_by_staff_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("abuse_signals_org_idx").using("btree", table.organizationId.asc().nullsLast().op("int8_ops")),
	index("abuse_signals_queue_idx").using("btree", table.kind.asc().nullsLast().op("text_ops"), table.score.desc().nullsFirst().op("text_ops")).where(sql`(status = 'open'::text)`),
	index("abuse_signals_staff_idx").using("btree", table.reviewedByStaffId.asc().nullsLast().op("int8_ops")),
	index("abuse_signals_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "abuse_signals_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.reviewedByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "abuse_signals_reviewed_by_staff_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "abuse_signals_user_id_fkey"
		}).onDelete("cascade"),
	check("abuse_signals_kind_check", sql`kind = ANY (ARRAY['free_tier_multi_account'::text, 'payment_fraud'::text, 'content_flag'::text, 'rate_abuse'::text, 'prompt_injection'::text, 'credential_stuffing'::text, 'other'::text])`),
	check("abuse_signals_status_check", sql`status = ANY (ARRAY['open'::text, 'confirmed'::text, 'false_positive'::text, 'actioned'::text])`),
]);

export const settingsInPlatform = platform.table("settings", {
	key: text().primaryKey().notNull(),
	category: text().notNull(),
	value: jsonb().notNull(),
	valueSchema: jsonb("value_schema"),
	description: jsonb(),
	isPublic: boolean("is_public").default(false).notNull(),
	updatedByStaffId: bigint("updated_by_staff_id", { mode: "bigint" }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("settings_category_idx").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("settings_staff_idx").using("btree", table.updatedByStaffId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.updatedByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "settings_updated_by_staff_id_fkey"
		}).onDelete("set null"),
	check("settings_category_check", sql`category = ANY (ARRAY['brand'::text, 'signup'::text, 'localization'::text, 'payments'::text, 'communications'::text, 'security'::text, 'limits'::text, 'free_tier'::text, 'retention'::text, 'legal'::text, 'api'::text, 'ai'::text, 'mcp'::text, 'agents'::text, 'marketplace'::text, 'system'::text])`),
	check("settings_key_check", sql`key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'::text`),
]);

export const staffRolePermissionsInPlatform = platform.table("staff_role_permissions", {
	roleId: bigint("role_id", { mode: "bigint" }).notNull(),
	permissionId: bigint("permission_id", { mode: "bigint" }).notNull(),
}, (table) => [
	index("staff_role_permissions_perm_idx").using("btree", table.permissionId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.permissionId],
			foreignColumns: [staffPermissionsInPlatform.id],
			name: "staff_role_permissions_permission_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [staffRolesInPlatform.id],
			name: "staff_role_permissions_role_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.permissionId, table.roleId], name: "staff_role_permissions_pkey"}),
]);

export const rolePermissionsInIam = iam.table("role_permissions", {
	roleId: bigint("role_id", { mode: "bigint" }).notNull(),
	permissionId: bigint("permission_id", { mode: "bigint" }).notNull(),
}, (table) => [
	index("role_permissions_permission_idx").using("btree", table.permissionId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.permissionId],
			foreignColumns: [permissionsInIam.id],
			name: "role_permissions_permission_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [rolesInIam.id],
			name: "role_permissions_role_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.permissionId, table.roleId], name: "role_permissions_pkey"}),
]);

export const planFeaturesInBilling = billing.table("plan_features", {
	planId: bigint("plan_id", { mode: "bigint" }).notNull(),
	featureId: bigint("feature_id", { mode: "bigint" }).notNull(),
	value: jsonb().notNull(),
}, (table) => [
	index("plan_features_feature_idx").using("btree", table.featureId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.featureId],
			foreignColumns: [featuresInBilling.id],
			name: "plan_features_feature_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [plansInBilling.id],
			name: "plan_features_plan_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.featureId, table.planId], name: "plan_features_pkey"}),
]);

export const invoiceSequencesInBilling = billing.table("invoice_sequences", {
	series: text().notNull(),
	year: smallint().notNull(),
	lastNumber: integer("last_number").default(0).notNull(),
}, (table) => [
	primaryKey({ columns: [table.series, table.year], name: "invoice_sequences_pkey"}),
]);

export const accessTokenToolsInMcp = mcp.table("access_token_tools", {
	tokenId: bigint("token_id", { mode: "bigint" }).notNull(),
	toolId: bigint("tool_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
}, (table) => [
	index("access_token_tools_token_idx").using("btree", table.tokenId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("access_token_tools_tool_idx").using("btree", table.toolId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.tokenId, table.organizationId],
			foreignColumns: [accessTokensInMcp.id, accessTokensInMcp.organizationId],
			name: "access_token_tools_token_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.toolId, table.organizationId],
			foreignColumns: [toolsInMcp.id, toolsInMcp.organizationId],
			name: "access_token_tools_tool_id_organization_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.tokenId, table.toolId], name: "access_token_tools_pkey"}),
]);

export const bundleItemsInMarket = market.table("bundle_items", {
	bundleListingId: bigint("bundle_listing_id", { mode: "bigint" }).notNull(),
	itemListingId: bigint("item_listing_id", { mode: "bigint" }).notNull(),
	position: smallint().default(0).notNull(),
}, (table) => [
	index("bundle_items_item_idx").using("btree", table.itemListingId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.bundleListingId],
			foreignColumns: [listingsInMarket.id],
			name: "bundle_items_bundle_listing_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.itemListingId],
			foreignColumns: [listingsInMarket.id],
			name: "bundle_items_item_listing_id_fkey"
		}),
	primaryKey({ columns: [table.bundleListingId, table.itemListingId], name: "bundle_items_pkey"}),
	check("bundle_items_check", sql`bundle_listing_id <> item_listing_id`),
]);

export const announcementDismissalsInPlatform = platform.table("announcement_dismissals", {
	announcementId: bigint("announcement_id", { mode: "bigint" }).notNull(),
	userId: bigint("user_id", { mode: "bigint" }).notNull(),
	dismissedAt: timestamp("dismissed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("announcement_dismissals_user_idx").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.announcementId],
			foreignColumns: [announcementsInPlatform.id],
			name: "announcement_dismissals_announcement_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInIam.id],
			name: "announcement_dismissals_user_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.announcementId, table.userId], name: "announcement_dismissals_pkey"}),
]);

export const staffUserRolesInPlatform = platform.table("staff_user_roles", {
	staffUserId: bigint("staff_user_id", { mode: "bigint" }).notNull(),
	roleId: bigint("role_id", { mode: "bigint" }).notNull(),
	grantedBy: bigint("granted_by", { mode: "bigint" }),
	grantedAt: timestamp("granted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("staff_user_roles_granter_idx").using("btree", table.grantedBy.asc().nullsLast().op("int8_ops")),
	index("staff_user_roles_role_idx").using("btree", table.roleId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.grantedBy],
			foreignColumns: [staffUsersInPlatform.id],
			name: "staff_user_roles_granted_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [staffRolesInPlatform.id],
			name: "staff_user_roles_role_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.staffUserId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "staff_user_roles_staff_user_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.roleId, table.staffUserId], name: "staff_user_roles_pkey"}),
]);

export const routingRuleTargetsInAi = ai.table("routing_rule_targets", {
	ruleId: bigint("rule_id", { mode: "bigint" }).notNull(),
	modelId: bigint("model_id", { mode: "bigint" }).notNull(),
	position: smallint().notNull(),
	weight: smallint().default(100).notNull(),
}, (table) => [
	index("routing_rule_targets_model_idx").using("btree", table.modelId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.modelId],
			foreignColumns: [modelsInAi.id],
			name: "routing_rule_targets_model_id_fkey"
		}),
	foreignKey({
			columns: [table.ruleId],
			foreignColumns: [routingRulesInAi.id],
			name: "routing_rule_targets_rule_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.position, table.ruleId], name: "routing_rule_targets_pkey"}),
	check("routing_rule_targets_position_check", sql`"position" >= 0`),
]);

export const teamMembersInIam = iam.table("team_members", {
	teamId: bigint("team_id", { mode: "bigint" }).notNull(),
	membershipId: bigint("membership_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("team_members_membership_idx").using("btree", table.membershipId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("team_members_team_org_idx").using("btree", table.teamId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.membershipId, table.organizationId],
			foreignColumns: [membershipsInIam.id, membershipsInIam.organizationId],
			name: "team_members_membership_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.teamId, table.organizationId],
			foreignColumns: [teamsInIam.id, teamsInIam.organizationId],
			name: "team_members_team_id_organization_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.membershipId, table.teamId], name: "team_members_pkey"}),
]);

export const capabilityReleaseVariantsInAi = ai.table("capability_release_variants", {
	releaseId: bigint("release_id", { mode: "bigint" }).notNull(),
	versionId: bigint("version_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	weightPct: smallint("weight_pct").notNull(),
}, (table) => [
	index("capability_release_variants_rel_org_idx").using("btree", table.releaseId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("capability_release_variants_version_idx").using("btree", table.versionId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.releaseId, table.organizationId],
			foreignColumns: [capabilityReleasesInAi.id, capabilityReleasesInAi.organizationId],
			name: "capability_release_variants_release_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.versionId, table.organizationId],
			foreignColumns: [capabilityVersionsInAi.id, capabilityVersionsInAi.organizationId],
			name: "capability_release_variants_version_id_organization_id_fkey"
		}),
	primaryKey({ columns: [table.releaseId, table.versionId], name: "capability_release_variants_pkey"}),
	check("capability_release_variants_weight_pct_check", sql`(weight_pct >= 0) AND (weight_pct <= 100)`),
]);

export const capabilityGrantsInAgent = agent.table("capability_grants", {
	agentVersionId: bigint("agent_version_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	capabilityId: bigint("capability_id", { mode: "bigint" }).notNull(),
	permission: text().default('allow').notNull(),
}, (table) => [
	index("capability_grants_capability_idx").using("btree", table.capabilityId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("capability_grants_version_idx").using("btree", table.agentVersionId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.agentVersionId, table.organizationId],
			foreignColumns: [versionsInAgent.id, versionsInAgent.organizationId],
			name: "capability_grants_agent_version_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId, table.capabilityId],
			foreignColumns: [capabilitiesInAi.id, capabilitiesInAi.organizationId],
			name: "capability_grants_capability_id_organization_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.agentVersionId, table.capabilityId], name: "capability_grants_pkey"}),
	check("capability_grants_permission_check", sql`permission = ANY (ARRAY['allow'::text, 'require_approval'::text, 'deny'::text])`),
]);

export const workspaceMembersInIam = iam.table("workspace_members", {
	workspaceId: bigint("workspace_id", { mode: "bigint" }).notNull(),
	membershipId: bigint("membership_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	roleId: bigint("role_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("workspace_members_membership_idx").using("btree", table.membershipId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("workspace_members_role_idx").using("btree", table.roleId.asc().nullsLast().op("int8_ops")),
	index("workspace_members_ws_org_idx").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.membershipId, table.organizationId],
			foreignColumns: [membershipsInIam.id, membershipsInIam.organizationId],
			name: "workspace_members_membership_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [rolesInIam.id],
			name: "workspace_members_role_id_fkey"
		}),
	foreignKey({
			columns: [table.workspaceId, table.organizationId],
			foreignColumns: [workspacesInIam.id, workspacesInIam.organizationId],
			name: "workspace_members_workspace_id_organization_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.membershipId, table.workspaceId], name: "workspace_members_pkey"}),
]);

export const featureFlagOverridesInPlatform = platform.table("feature_flag_overrides", {
	flagId: bigint("flag_id", { mode: "bigint" }).notNull(),
	targetType: text("target_type").notNull(),
	targetId: bigint("target_id", { mode: "bigint" }).notNull(),
	value: jsonb().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("feature_flag_overrides_target_idx").using("btree", table.targetType.asc().nullsLast().op("int8_ops"), table.targetId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.flagId],
			foreignColumns: [featureFlagsInPlatform.id],
			name: "feature_flag_overrides_flag_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.flagId, table.targetId, table.targetType], name: "feature_flag_overrides_pkey"}),
	check("feature_flag_overrides_target_type_check", sql`target_type = ANY (ARRAY['organization'::text, 'user'::text, 'workspace'::text])`),
]);

export const translationsInPlatform = platform.table("translations", {
	namespace: text().notNull(),
	key: text().notNull(),
	locale: text().notNull(),
	value: text().notNull(),
	updatedByStaffId: bigint("updated_by_staff_id", { mode: "bigint" }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("translations_locale_idx").using("btree", table.locale.asc().nullsLast().op("text_ops")),
	index("translations_staff_idx").using("btree", table.updatedByStaffId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.locale],
			foreignColumns: [languagesInRef.code],
			name: "translations_locale_fkey"
		}),
	foreignKey({
			columns: [table.updatedByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "translations_updated_by_staff_id_fkey"
		}).onDelete("set null"),
	primaryKey({ columns: [table.key, table.locale, table.namespace], name: "translations_pkey"}),
]);

export const organizationFeatureOverridesInBilling = billing.table("organization_feature_overrides", {
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	featureId: bigint("feature_id", { mode: "bigint" }).notNull(),
	value: jsonb().notNull(),
	reason: text(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	grantedByStaffId: bigint("granted_by_staff_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("org_feature_overrides_feature_idx").using("btree", table.featureId.asc().nullsLast().op("int8_ops")),
	index("org_feature_overrides_staff_idx").using("btree", table.grantedByStaffId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.grantedByStaffId],
			foreignColumns: [staffUsersInPlatform.id],
			name: "org_feature_overrides_staff_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.featureId],
			foreignColumns: [featuresInBilling.id],
			name: "organization_feature_overrides_feature_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInIam.id],
			name: "organization_feature_overrides_organization_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.featureId, table.organizationId], name: "organization_feature_overrides_pkey"}),
]);

export const evalResultsInAi = ai.table("eval_results", {
	evalRunId: bigint("eval_run_id", { mode: "bigint" }).notNull(),
	caseId: bigint("case_id", { mode: "bigint" }).notNull(),
	organizationId: bigint("organization_id", { mode: "bigint" }).notNull(),
	output: jsonb(),
	score: numeric({ precision: 6, scale:  3 }),
	passed: boolean(),
	details: jsonb().default({}).notNull(),
	runId: bigint("run_id", { mode: "bigint" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("eval_results_case_idx").using("btree", table.caseId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	index("eval_results_run_org_idx").using("btree", table.evalRunId.asc().nullsLast().op("int8_ops"), table.organizationId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.caseId, table.organizationId],
			foreignColumns: [evalCasesInAi.id, evalCasesInAi.organizationId],
			name: "eval_results_case_id_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.evalRunId, table.organizationId],
			foreignColumns: [evalRunsInAi.id, evalRunsInAi.organizationId],
			name: "eval_results_eval_run_id_organization_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.caseId, table.evalRunId], name: "eval_results_pkey"}),
]);
