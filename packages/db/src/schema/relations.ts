import { relations } from "drizzle-orm/relations";
import { staffUsersInPlatform, staffSessionsInPlatform, staffApiKeysInPlatform, organizationsInIam, impersonationSessionsInPlatform, usersInIam, supportTicketsInPlatform, staffNotesInPlatform, settingsHistoryInPlatform, secretsInIam, serviceAccountsInPlatform, moderationReportsInPlatform, moderationActionsInPlatform, currenciesInRef, countriesInRef, dataRegionsInRef, languagesInRef, fxRatesInRef, taxRatesInRef, userIdentitiesInIam, userMfaFactorsInIam, verificationTokensInIam, paymentsInBilling, paymentEventsInBilling, paymentProvidersInBilling, referralsInBilling, creditGrantsInBilling, payoutsInMarket, paymentMethodsInBilling, publishersInMarket, earningsInMarket, invoiceLinesInBilling, listingsInMarket, cookieConsentsInCompliance, plansInBilling, planPricesInBilling, creditPackPricesInBilling, creditPacksInBilling, infraMetersInBilling, infraMeterRatesInBilling, modelsInAi, modelDeploymentsInAi, providerAccountsInAi, providersInAi, modelPricesInAi, filesInStorage, connectorDefinitionsInMcp, categoriesInMarket, legalDocumentsInCompliance, couponsInBilling, guardrailDetectorsInAi, providerAccountSnapshotsInAi, dataBreachesInCompliance, transferAuthorizationsInCompliance, backendsInStorage, backendMigrationsInStorage, featureFlagsInPlatform, messageTemplatesInPlatform, announcementsInPlatform, incidentsInPlatform, incidentUpdatesInPlatform, maintenanceWindowsInPlatform, rateLimitPoliciesInPlatform, emergencyStopsInPlatform, userSessionsInIam, blocklistEntriesInPlatform, routingRulesInAi, routingProfilesInAi, byokKeysInAi, environmentsInIam, workspacesInIam, capabilitiesInAi, rolesInIam, membershipsInIam, invitationsInIam, teamsInIam, projectsInIam, subscriptionsInBilling, subscriptionEventsInBilling, creditWalletsInBilling, creditReservationsInBilling, invoicesInBilling, refundsInBilling, budgetsInBilling, budgetPeriodsInBilling, couponRedemptionsInBilling, capabilityVersionsInAi, capabilityReleasesInAi, evalRunsInAi, evalDatasetsInAi, evalCasesInAi, oauthConnectionsInMcp, bridgesInMcp, connectorsInMcp, connectorCredentialsInMcp, connectorSourcesInMcp, connectorActionsInMcp, fileDatasetsInMcp, serverVersionsInMcp, serversInMcp, toolsInMcp, toolEmbeddingsInMcp, resourcesInMcp, promptsInMcp, accessTokensInMcp, healthChecksInMcp, oauthClientsInIam, oauthConsentsInIam, oauthAuthorizationCodesInIam, oauthTokensInIam, agentsInAgent, versionsInAgent, toolGrantsInAgent, triggersInAgent, webhookEndpointsInDev, approvalsInAgent, memoriesInAgent, conversationsInAgent, endUsersInDev, messagesInAgent, apiKeysInDev, webhookSubscriptionsInDev, idempotencyKeysInDev, deviceAuthorizationsInDev, listingVersionsInMarket, entitlementsInMarket, installationsInMarket, reviewsInMarket, legalAcceptancesInCompliance, dataSubjectRequestsInCompliance, guardrailProfilesInAi, guardrailRulesInAi, guardrailBindingsInAi, listingPricesInMarket, userPreferencesInUx, uiStatesInUx, onboardingProgressInUx, draftsInUx, savedViewsInUx, dashboardsInUx, notificationsInNotif, preferencesInNotif, deliveriesInNotif, supportMessagesInPlatform, abuseSignalsInPlatform, settingsInPlatform, staffPermissionsInPlatform, staffRolePermissionsInPlatform, staffRolesInPlatform, permissionsInIam, rolePermissionsInIam, featuresInBilling, planFeaturesInBilling, accessTokenToolsInMcp, bundleItemsInMarket, announcementDismissalsInPlatform, staffUserRolesInPlatform, routingRuleTargetsInAi, teamMembersInIam, capabilityReleaseVariantsInAi, capabilityGrantsInAgent, workspaceMembersInIam, featureFlagOverridesInPlatform, translationsInPlatform, organizationFeatureOverridesInBilling, evalResultsInAi, creditLedgerDefaultInBilling, creditLedgerP202609InBilling, creditLedgerP202610InBilling, creditLedgerP202611InBilling, creditLedgerP202612InBilling } from "./schema";

export const staffSessionsInPlatformRelations = relations(staffSessionsInPlatform, ({one}) => ({
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [staffSessionsInPlatform.staffUserId],
		references: [staffUsersInPlatform.id]
	}),
}));

export const staffUsersInPlatformRelations = relations(staffUsersInPlatform, ({many}) => ({
	staffSessionsInPlatforms: many(staffSessionsInPlatform),
	staffApiKeysInPlatforms: many(staffApiKeysInPlatform),
	impersonationSessionsInPlatforms: many(impersonationSessionsInPlatform),
	staffNotesInPlatforms: many(staffNotesInPlatform),
	settingsHistoryInPlatforms: many(settingsHistoryInPlatform),
	moderationActionsInPlatforms: many(moderationActionsInPlatform),
	couponsInBillings: many(couponsInBilling),
	dataBreachesInCompliances: many(dataBreachesInCompliance),
	backendMigrationsInStorages: many(backendMigrationsInStorage),
	featureFlagsInPlatforms: many(featureFlagsInPlatform),
	messageTemplatesInPlatforms: many(messageTemplatesInPlatform),
	announcementsInPlatforms: many(announcementsInPlatform),
	incidentsInPlatforms: many(incidentsInPlatform),
	incidentUpdatesInPlatforms: many(incidentUpdatesInPlatform),
	maintenanceWindowsInPlatforms: many(maintenanceWindowsInPlatform),
	rateLimitPoliciesInPlatforms: many(rateLimitPoliciesInPlatform),
	emergencyStopsInPlatforms_activatedByStaffId: many(emergencyStopsInPlatform, {
		relationName: "emergencyStopsInPlatform_activatedByStaffId_staffUsersInPlatform_id"
	}),
	emergencyStopsInPlatforms_deactivatedByStaffId: many(emergencyStopsInPlatform, {
		relationName: "emergencyStopsInPlatform_deactivatedByStaffId_staffUsersInPlatform_id"
	}),
	blocklistEntriesInPlatforms: many(blocklistEntriesInPlatform),
	dataSubjectRequestsInCompliances: many(dataSubjectRequestsInCompliance),
	listingVersionsInMarkets: many(listingVersionsInMarket),
	supportTicketsInPlatforms: many(supportTicketsInPlatform),
	supportMessagesInPlatforms: many(supportMessagesInPlatform),
	moderationReportsInPlatforms: many(moderationReportsInPlatform),
	abuseSignalsInPlatforms: many(abuseSignalsInPlatform),
	settingsInPlatforms: many(settingsInPlatform),
	staffUserRolesInPlatforms_grantedBy: many(staffUserRolesInPlatform, {
		relationName: "staffUserRolesInPlatform_grantedBy_staffUsersInPlatform_id"
	}),
	staffUserRolesInPlatforms_staffUserId: many(staffUserRolesInPlatform, {
		relationName: "staffUserRolesInPlatform_staffUserId_staffUsersInPlatform_id"
	}),
	translationsInPlatforms: many(translationsInPlatform),
	organizationFeatureOverridesInBillings: many(organizationFeatureOverridesInBilling),
}));

export const staffApiKeysInPlatformRelations = relations(staffApiKeysInPlatform, ({one}) => ({
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [staffApiKeysInPlatform.staffUserId],
		references: [staffUsersInPlatform.id]
	}),
}));

export const impersonationSessionsInPlatformRelations = relations(impersonationSessionsInPlatform, ({one}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [impersonationSessionsInPlatform.organizationId],
		references: [organizationsInIam.id]
	}),
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [impersonationSessionsInPlatform.staffUserId],
		references: [staffUsersInPlatform.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [impersonationSessionsInPlatform.targetUserId],
		references: [usersInIam.id]
	}),
	supportTicketsInPlatform: one(supportTicketsInPlatform, {
		fields: [impersonationSessionsInPlatform.supportTicketId],
		references: [supportTicketsInPlatform.id]
	}),
}));

export const organizationsInIamRelations = relations(organizationsInIam, ({one, many}) => ({
	impersonationSessionsInPlatforms: many(impersonationSessionsInPlatform),
	referralsInBillings_referredOrgId: many(referralsInBilling, {
		relationName: "referralsInBilling_referredOrgId_organizationsInIam_id"
	}),
	referralsInBillings_referrerOrgId: many(referralsInBilling, {
		relationName: "referralsInBilling_referrerOrgId_organizationsInIam_id"
	}),
	earningsInMarkets: many(earningsInMarket),
	routingRulesInAis: many(routingRulesInAi),
	byokKeysInAis: many(byokKeysInAi),
	rolesInIam: many(rolesInIam),
	membershipsInIam: many(membershipsInIam),
	invitationsInIam: many(invitationsInIam),
	teamsInIam: many(teamsInIam),
	workspacesInIam: many(workspacesInIam),
	filesInStorages: many(filesInStorage),
	subscriptionsInBillings: many(subscriptionsInBilling),
	subscriptionEventsInBillings: many(subscriptionEventsInBilling),
	creditWalletsInBillings: many(creditWalletsInBilling),
	paymentMethodsInBillings: many(paymentMethodsInBilling),
	invoicesInBillings: many(invoicesInBilling),
	paymentsInBillings: many(paymentsInBilling),
	refundsInBillings: many(refundsInBilling),
	budgetsInBillings: many(budgetsInBilling),
	couponRedemptionsInBillings: many(couponRedemptionsInBilling),
	secretsInIam: many(secretsInIam),
	routingProfilesInAis: many(routingProfilesInAi, {
		relationName: "routingProfilesInAi_organizationId_organizationsInIam_id"
	}),
	oauthConnectionsInMcps: many(oauthConnectionsInMcp),
	healthChecksInMcps: many(healthChecksInMcp),
	oauthAuthorizationCodesInIam: many(oauthAuthorizationCodesInIam),
	oauthTokensInIam: many(oauthTokensInIam),
	idempotencyKeysInDevs: many(idempotencyKeysInDev),
	deviceAuthorizationsInDevs: many(deviceAuthorizationsInDev),
	publishersInMarkets: many(publishersInMarket),
	listingsInMarkets: many(listingsInMarket),
	entitlementsInMarkets: many(entitlementsInMarket),
	reviewsInMarkets: many(reviewsInMarket),
	legalAcceptancesInCompliances: many(legalAcceptancesInCompliance),
	dataSubjectRequestsInCompliances: many(dataSubjectRequestsInCompliance),
	guardrailProfilesInAis: many(guardrailProfilesInAi),
	guardrailRulesInAis: many(guardrailRulesInAi),
	guardrailBindingsInAis: many(guardrailBindingsInAi),
	countriesInRef: one(countriesInRef, {
		fields: [organizationsInIam.countryCode],
		references: [countriesInRef.code]
	}),
	usersInIam: one(usersInIam, {
		fields: [organizationsInIam.createdByUserId],
		references: [usersInIam.id]
	}),
	dataRegionsInRef: one(dataRegionsInRef, {
		fields: [organizationsInIam.dataRegionId],
		references: [dataRegionsInRef.id]
	}),
	currenciesInRef: one(currenciesInRef, {
		fields: [organizationsInIam.defaultCurrency],
		references: [currenciesInRef.code]
	}),
	languagesInRef: one(languagesInRef, {
		fields: [organizationsInIam.defaultLocale],
		references: [languagesInRef.code]
	}),
	routingProfilesInAi: one(routingProfilesInAi, {
		fields: [organizationsInIam.defaultRoutingProfileId],
		references: [routingProfilesInAi.id],
		relationName: "organizationsInIam_defaultRoutingProfileId_routingProfilesInAi_id"
	}),
	userPreferencesInUxes: many(userPreferencesInUx),
	uiStatesInUxes: many(uiStatesInUx),
	onboardingProgressInUxes: many(onboardingProgressInUx),
	savedViewsInUxes: many(savedViewsInUx),
	dashboardsInUxes: many(dashboardsInUx),
	notificationsInNotifs: many(notificationsInNotif),
	preferencesInNotifs: many(preferencesInNotif),
	deliveriesInNotifs: many(deliveriesInNotif),
	supportTicketsInPlatforms: many(supportTicketsInPlatform),
	moderationReportsInPlatforms: many(moderationReportsInPlatform),
	abuseSignalsInPlatforms: many(abuseSignalsInPlatform),
	organizationFeatureOverridesInBillings: many(organizationFeatureOverridesInBilling),
}));

export const usersInIamRelations = relations(usersInIam, ({one, many}) => ({
	impersonationSessionsInPlatforms: many(impersonationSessionsInPlatform),
	userIdentitiesInIam: many(userIdentitiesInIam),
	userMfaFactorsInIam: many(userMfaFactorsInIam),
	verificationTokensInIam: many(verificationTokensInIam),
	referralsInBillings: many(referralsInBilling),
	cookieConsentsInCompliances: many(cookieConsentsInCompliance),
	userSessionsInIam: many(userSessionsInIam),
	filesInStorage: one(filesInStorage, {
		fields: [usersInIam.avatarFileId],
		references: [filesInStorage.id],
		relationName: "usersInIam_avatarFileId_filesInStorage_id"
	}),
	countriesInRef: one(countriesInRef, {
		fields: [usersInIam.countryCode],
		references: [countriesInRef.code]
	}),
	languagesInRef: one(languagesInRef, {
		fields: [usersInIam.locale],
		references: [languagesInRef.code]
	}),
	byokKeysInAis: many(byokKeysInAi),
	capabilitiesInAis: many(capabilitiesInAi),
	membershipsInIam_invitedByUserId: many(membershipsInIam, {
		relationName: "membershipsInIam_invitedByUserId_usersInIam_id"
	}),
	membershipsInIam_userId: many(membershipsInIam, {
		relationName: "membershipsInIam_userId_usersInIam_id"
	}),
	invitationsInIam: many(invitationsInIam),
	workspacesInIam: many(workspacesInIam),
	filesInStorages: many(filesInStorage, {
		relationName: "filesInStorage_uploadedByUserId_usersInIam_id"
	}),
	paymentsInBillings: many(paymentsInBilling),
	budgetsInBillings: many(budgetsInBilling),
	couponRedemptionsInBillings: many(couponRedemptionsInBilling),
	secretsInIam: many(secretsInIam),
	capabilityVersionsInAis: many(capabilityVersionsInAi),
	capabilityReleasesInAis: many(capabilityReleasesInAi),
	evalDatasetsInAis: many(evalDatasetsInAi),
	evalRunsInAis: many(evalRunsInAi),
	oauthConnectionsInMcps: many(oauthConnectionsInMcp),
	bridgesInMcps: many(bridgesInMcp),
	connectorsInMcps: many(connectorsInMcp),
	serversInMcps: many(serversInMcp),
	serverVersionsInMcps: many(serverVersionsInMcp),
	accessTokensInMcps_createdByUserId: many(accessTokensInMcp, {
		relationName: "accessTokensInMcp_createdByUserId_usersInIam_id"
	}),
	accessTokensInMcps_revokedByUserId: many(accessTokensInMcp, {
		relationName: "accessTokensInMcp_revokedByUserId_usersInIam_id"
	}),
	oauthConsentsInIam: many(oauthConsentsInIam),
	oauthAuthorizationCodesInIam: many(oauthAuthorizationCodesInIam),
	oauthTokensInIam: many(oauthTokensInIam),
	agentsInAgents: many(agentsInAgent),
	versionsInAgents: many(versionsInAgent),
	approvalsInAgents: many(approvalsInAgent),
	conversationsInAgents: many(conversationsInAgent),
	messagesInAgents: many(messagesInAgent),
	apiKeysInDevs: many(apiKeysInDev),
	webhookSubscriptionsInDevs: many(webhookSubscriptionsInDev),
	deviceAuthorizationsInDevs: many(deviceAuthorizationsInDev),
	installationsInMarkets: many(installationsInMarket),
	reviewsInMarkets: many(reviewsInMarket),
	legalAcceptancesInCompliances: many(legalAcceptancesInCompliance),
	dataSubjectRequestsInCompliances: many(dataSubjectRequestsInCompliance),
	organizationsInIam: many(organizationsInIam),
	userPreferencesInUxes: many(userPreferencesInUx),
	uiStatesInUxes: many(uiStatesInUx),
	onboardingProgressInUxes: many(onboardingProgressInUx),
	draftsInUxes: many(draftsInUx),
	savedViewsInUxes: many(savedViewsInUx),
	dashboardsInUxes: many(dashboardsInUx),
	notificationsInNotifs: many(notificationsInNotif),
	preferencesInNotifs: many(preferencesInNotif),
	supportTicketsInPlatforms: many(supportTicketsInPlatform),
	supportMessagesInPlatforms: many(supportMessagesInPlatform),
	moderationReportsInPlatforms: many(moderationReportsInPlatform),
	abuseSignalsInPlatforms: many(abuseSignalsInPlatform),
	announcementDismissalsInPlatforms: many(announcementDismissalsInPlatform),
}));

export const supportTicketsInPlatformRelations = relations(supportTicketsInPlatform, ({one, many}) => ({
	impersonationSessionsInPlatforms: many(impersonationSessionsInPlatform),
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [supportTicketsInPlatform.assignedStaffId],
		references: [staffUsersInPlatform.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [supportTicketsInPlatform.organizationId],
		references: [organizationsInIam.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [supportTicketsInPlatform.userId],
		references: [usersInIam.id]
	}),
	supportMessagesInPlatforms: many(supportMessagesInPlatform),
}));

export const staffNotesInPlatformRelations = relations(staffNotesInPlatform, ({one}) => ({
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [staffNotesInPlatform.staffUserId],
		references: [staffUsersInPlatform.id]
	}),
}));

export const settingsHistoryInPlatformRelations = relations(settingsHistoryInPlatform, ({one}) => ({
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [settingsHistoryInPlatform.changedByStaffId],
		references: [staffUsersInPlatform.id]
	}),
}));

export const serviceAccountsInPlatformRelations = relations(serviceAccountsInPlatform, ({one}) => ({
	secretsInIam: one(secretsInIam, {
		fields: [serviceAccountsInPlatform.secretId],
		references: [secretsInIam.id]
	}),
}));

export const secretsInIamRelations = relations(secretsInIam, ({one, many}) => ({
	serviceAccountsInPlatforms: many(serviceAccountsInPlatform),
	providerAccountsInAis: many(providerAccountsInAi),
	byokKeysInAis: many(byokKeysInAi),
	usersInIam: one(usersInIam, {
		fields: [secretsInIam.createdByUserId],
		references: [usersInIam.id]
	}),
	environmentsInIam: one(environmentsInIam, {
		fields: [secretsInIam.organizationId],
		references: [environmentsInIam.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [secretsInIam.organizationId],
		references: [organizationsInIam.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [secretsInIam.organizationId],
		references: [workspacesInIam.id]
	}),
	oauthConnectionsInMcps_organizationId: many(oauthConnectionsInMcp, {
		relationName: "oauthConnectionsInMcp_organizationId_secretsInIam_id"
	}),
	oauthConnectionsInMcps_organizationId: many(oauthConnectionsInMcp, {
		relationName: "oauthConnectionsInMcp_organizationId_secretsInIam_id"
	}),
	connectorCredentialsInMcps: many(connectorCredentialsInMcp),
	webhookEndpointsInDevs: many(webhookEndpointsInDev),
	webhookSubscriptionsInDevs: many(webhookSubscriptionsInDev),
}));

export const moderationActionsInPlatformRelations = relations(moderationActionsInPlatform, ({one}) => ({
	moderationReportsInPlatform: one(moderationReportsInPlatform, {
		fields: [moderationActionsInPlatform.reportId],
		references: [moderationReportsInPlatform.id]
	}),
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [moderationActionsInPlatform.staffUserId],
		references: [staffUsersInPlatform.id]
	}),
}));

export const moderationReportsInPlatformRelations = relations(moderationReportsInPlatform, ({one, many}) => ({
	moderationActionsInPlatforms: many(moderationActionsInPlatform),
	organizationsInIam: one(organizationsInIam, {
		fields: [moderationReportsInPlatform.reporterOrgId],
		references: [organizationsInIam.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [moderationReportsInPlatform.reporterUserId],
		references: [usersInIam.id]
	}),
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [moderationReportsInPlatform.resolvedByStaffId],
		references: [staffUsersInPlatform.id]
	}),
}));

export const countriesInRefRelations = relations(countriesInRef, ({one, many}) => ({
	currenciesInRef: one(currenciesInRef, {
		fields: [countriesInRef.defaultCurrency],
		references: [currenciesInRef.code]
	}),
	dataRegionsInRef: one(dataRegionsInRef, {
		fields: [countriesInRef.defaultDataRegionId],
		references: [dataRegionsInRef.id]
	}),
	languagesInRef: one(languagesInRef, {
		fields: [countriesInRef.defaultLanguage],
		references: [languagesInRef.code]
	}),
	taxRatesInRefs: many(taxRatesInRef),
	usersInIam: many(usersInIam),
	paymentMethodsInBillings: many(paymentMethodsInBilling),
	organizationsInIam: many(organizationsInIam),
}));

export const currenciesInRefRelations = relations(currenciesInRef, ({many}) => ({
	countriesInRefs: many(countriesInRef),
	fxRatesInRefs_baseCurrency: many(fxRatesInRef, {
		relationName: "fxRatesInRef_baseCurrency_currenciesInRef_code"
	}),
	fxRatesInRefs_quoteCurrency: many(fxRatesInRef, {
		relationName: "fxRatesInRef_quoteCurrency_currenciesInRef_code"
	}),
	payoutsInMarkets: many(payoutsInMarket),
	earningsInMarkets: many(earningsInMarket),
	planPricesInBillings: many(planPricesInBilling),
	creditPackPricesInBillings: many(creditPackPricesInBilling),
	couponsInBillings: many(couponsInBilling),
	providerAccountsInAis: many(providerAccountsInAi),
	providerAccountSnapshotsInAis: many(providerAccountSnapshotsInAi),
	subscriptionsInBillings: many(subscriptionsInBilling),
	invoicesInBillings: many(invoicesInBilling),
	paymentsInBillings: many(paymentsInBilling),
	publishersInMarkets: many(publishersInMarket),
	organizationsInIam: many(organizationsInIam),
	listingPricesInMarkets: many(listingPricesInMarket),
	userPreferencesInUxes: many(userPreferencesInUx),
}));

export const dataRegionsInRefRelations = relations(dataRegionsInRef, ({many}) => ({
	countriesInRefs: many(countriesInRef),
	backendsInStorages: many(backendsInStorage),
	maintenanceWindowsInPlatforms: many(maintenanceWindowsInPlatform),
	workspacesInIam: many(workspacesInIam),
	filesInStorages: many(filesInStorage),
	organizationsInIam: many(organizationsInIam),
}));

export const languagesInRefRelations = relations(languagesInRef, ({many}) => ({
	countriesInRefs: many(countriesInRef),
	legalDocumentsInCompliances: many(legalDocumentsInCompliance),
	messageTemplatesInPlatforms: many(messageTemplatesInPlatform),
	usersInIam: many(usersInIam),
	versionsInAgents: many(versionsInAgent),
	organizationsInIam: many(organizationsInIam),
	deliveriesInNotifs: many(deliveriesInNotif),
	translationsInPlatforms: many(translationsInPlatform),
}));

export const fxRatesInRefRelations = relations(fxRatesInRef, ({one}) => ({
	currenciesInRef_baseCurrency: one(currenciesInRef, {
		fields: [fxRatesInRef.baseCurrency],
		references: [currenciesInRef.code],
		relationName: "fxRatesInRef_baseCurrency_currenciesInRef_code"
	}),
	currenciesInRef_quoteCurrency: one(currenciesInRef, {
		fields: [fxRatesInRef.quoteCurrency],
		references: [currenciesInRef.code],
		relationName: "fxRatesInRef_quoteCurrency_currenciesInRef_code"
	}),
}));

export const taxRatesInRefRelations = relations(taxRatesInRef, ({one, many}) => ({
	countriesInRef: one(countriesInRef, {
		fields: [taxRatesInRef.countryCode],
		references: [countriesInRef.code]
	}),
	invoiceLinesInBillings: many(invoiceLinesInBilling),
}));

export const userIdentitiesInIamRelations = relations(userIdentitiesInIam, ({one}) => ({
	usersInIam: one(usersInIam, {
		fields: [userIdentitiesInIam.userId],
		references: [usersInIam.id]
	}),
}));

export const userMfaFactorsInIamRelations = relations(userMfaFactorsInIam, ({one}) => ({
	usersInIam: one(usersInIam, {
		fields: [userMfaFactorsInIam.userId],
		references: [usersInIam.id]
	}),
}));

export const verificationTokensInIamRelations = relations(verificationTokensInIam, ({one}) => ({
	usersInIam: one(usersInIam, {
		fields: [verificationTokensInIam.userId],
		references: [usersInIam.id]
	}),
}));

export const paymentEventsInBillingRelations = relations(paymentEventsInBilling, ({one}) => ({
	paymentsInBilling: one(paymentsInBilling, {
		fields: [paymentEventsInBilling.paymentId],
		references: [paymentsInBilling.id]
	}),
	paymentProvidersInBilling: one(paymentProvidersInBilling, {
		fields: [paymentEventsInBilling.providerId],
		references: [paymentProvidersInBilling.id]
	}),
}));

export const paymentsInBillingRelations = relations(paymentsInBilling, ({one, many}) => ({
	paymentEventsInBillings: many(paymentEventsInBilling),
	currenciesInRef: one(currenciesInRef, {
		fields: [paymentsInBilling.currency],
		references: [currenciesInRef.code]
	}),
	usersInIam: one(usersInIam, {
		fields: [paymentsInBilling.initiatedByUserId],
		references: [usersInIam.id]
	}),
	invoicesInBilling: one(invoicesInBilling, {
		fields: [paymentsInBilling.invoiceId],
		references: [invoicesInBilling.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [paymentsInBilling.organizationId],
		references: [organizationsInIam.id]
	}),
	paymentMethodsInBilling: one(paymentMethodsInBilling, {
		fields: [paymentsInBilling.paymentMethodId],
		references: [paymentMethodsInBilling.id]
	}),
	paymentProvidersInBilling: one(paymentProvidersInBilling, {
		fields: [paymentsInBilling.providerId],
		references: [paymentProvidersInBilling.id]
	}),
	refundsInBillings: many(refundsInBilling),
}));

export const paymentProvidersInBillingRelations = relations(paymentProvidersInBilling, ({many}) => ({
	paymentEventsInBillings: many(paymentEventsInBilling),
	paymentMethodsInBillings: many(paymentMethodsInBilling),
	paymentsInBillings: many(paymentsInBilling),
}));

export const referralsInBillingRelations = relations(referralsInBilling, ({one}) => ({
	organizationsInIam_referredOrgId: one(organizationsInIam, {
		fields: [referralsInBilling.referredOrgId],
		references: [organizationsInIam.id],
		relationName: "referralsInBilling_referredOrgId_organizationsInIam_id"
	}),
	organizationsInIam_referrerOrgId: one(organizationsInIam, {
		fields: [referralsInBilling.referrerOrgId],
		references: [organizationsInIam.id],
		relationName: "referralsInBilling_referrerOrgId_organizationsInIam_id"
	}),
	usersInIam: one(usersInIam, {
		fields: [referralsInBilling.referrerUserId],
		references: [usersInIam.id]
	}),
	creditGrantsInBilling: one(creditGrantsInBilling, {
		fields: [referralsInBilling.rewardGrantId],
		references: [creditGrantsInBilling.id]
	}),
}));

export const creditGrantsInBillingRelations = relations(creditGrantsInBilling, ({one, many}) => ({
	referralsInBillings: many(referralsInBilling),
	creditWalletsInBilling: one(creditWalletsInBilling, {
		fields: [creditGrantsInBilling.organizationId],
		references: [creditWalletsInBilling.id]
	}),
	couponRedemptionsInBillings: many(couponRedemptionsInBilling),
}));

export const payoutsInMarketRelations = relations(payoutsInMarket, ({one, many}) => ({
	currenciesInRef: one(currenciesInRef, {
		fields: [payoutsInMarket.currency],
		references: [currenciesInRef.code]
	}),
	paymentMethodsInBilling: one(paymentMethodsInBilling, {
		fields: [payoutsInMarket.paymentMethodId],
		references: [paymentMethodsInBilling.id]
	}),
	publishersInMarket: one(publishersInMarket, {
		fields: [payoutsInMarket.publisherId],
		references: [publishersInMarket.id]
	}),
	earningsInMarkets: many(earningsInMarket),
}));

export const paymentMethodsInBillingRelations = relations(paymentMethodsInBilling, ({one, many}) => ({
	payoutsInMarkets: many(payoutsInMarket),
	subscriptionsInBillings: many(subscriptionsInBilling),
	countriesInRef: one(countriesInRef, {
		fields: [paymentMethodsInBilling.countryCode],
		references: [countriesInRef.code]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [paymentMethodsInBilling.organizationId],
		references: [organizationsInIam.id]
	}),
	paymentProvidersInBilling: one(paymentProvidersInBilling, {
		fields: [paymentMethodsInBilling.providerId],
		references: [paymentProvidersInBilling.id]
	}),
	paymentsInBillings: many(paymentsInBilling),
	publishersInMarkets: many(publishersInMarket),
}));

export const publishersInMarketRelations = relations(publishersInMarket, ({one, many}) => ({
	payoutsInMarkets: many(payoutsInMarket),
	earningsInMarkets: many(earningsInMarket),
	filesInStorage: one(filesInStorage, {
		fields: [publishersInMarket.logoFileId],
		references: [filesInStorage.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [publishersInMarket.organizationId],
		references: [organizationsInIam.id]
	}),
	currenciesInRef: one(currenciesInRef, {
		fields: [publishersInMarket.payoutCurrency],
		references: [currenciesInRef.code]
	}),
	paymentMethodsInBilling: one(paymentMethodsInBilling, {
		fields: [publishersInMarket.payoutMethodId],
		references: [paymentMethodsInBilling.id]
	}),
	listingsInMarkets: many(listingsInMarket),
}));

export const earningsInMarketRelations = relations(earningsInMarket, ({one}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [earningsInMarket.buyerOrgId],
		references: [organizationsInIam.id]
	}),
	currenciesInRef: one(currenciesInRef, {
		fields: [earningsInMarket.currency],
		references: [currenciesInRef.code]
	}),
	invoiceLinesInBilling: one(invoiceLinesInBilling, {
		fields: [earningsInMarket.invoiceLineId],
		references: [invoiceLinesInBilling.id]
	}),
	listingsInMarket: one(listingsInMarket, {
		fields: [earningsInMarket.listingId],
		references: [listingsInMarket.id]
	}),
	payoutsInMarket: one(payoutsInMarket, {
		fields: [earningsInMarket.payoutId],
		references: [payoutsInMarket.id]
	}),
	publishersInMarket: one(publishersInMarket, {
		fields: [earningsInMarket.publisherId],
		references: [publishersInMarket.id]
	}),
}));

export const invoiceLinesInBillingRelations = relations(invoiceLinesInBilling, ({one, many}) => ({
	earningsInMarkets: many(earningsInMarket),
	invoicesInBilling: one(invoicesInBilling, {
		fields: [invoiceLinesInBilling.invoiceId],
		references: [invoicesInBilling.id]
	}),
	taxRatesInRef: one(taxRatesInRef, {
		fields: [invoiceLinesInBilling.taxRateId],
		references: [taxRatesInRef.id]
	}),
	entitlementsInMarkets: many(entitlementsInMarket),
}));

export const listingsInMarketRelations = relations(listingsInMarket, ({one, many}) => ({
	earningsInMarkets: many(earningsInMarket),
	capabilitiesInAis: many(capabilitiesInAi),
	connectorsInMcps: many(connectorsInMcp),
	serversInMcps: many(serversInMcp),
	agentsInAgents: many(agentsInAgent),
	categoriesInMarket: one(categoriesInMarket, {
		fields: [listingsInMarket.categoryId],
		references: [categoriesInMarket.id]
	}),
	listingVersionsInMarket: one(listingVersionsInMarket, {
		fields: [listingsInMarket.currentVersionId],
		references: [listingVersionsInMarket.id],
		relationName: "listingsInMarket_currentVersionId_listingVersionsInMarket_id"
	}),
	filesInStorage: one(filesInStorage, {
		fields: [listingsInMarket.iconFileId],
		references: [filesInStorage.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [listingsInMarket.organizationId],
		references: [organizationsInIam.id]
	}),
	publishersInMarket: one(publishersInMarket, {
		fields: [listingsInMarket.publisherId],
		references: [publishersInMarket.id]
	}),
	entitlementsInMarkets: many(entitlementsInMarket),
	installationsInMarkets: many(installationsInMarket),
	reviewsInMarkets: many(reviewsInMarket),
	listingVersionsInMarkets: many(listingVersionsInMarket, {
		relationName: "listingVersionsInMarket_listingId_listingsInMarket_id"
	}),
	listingPricesInMarkets: many(listingPricesInMarket),
	bundleItemsInMarkets_bundleListingId: many(bundleItemsInMarket, {
		relationName: "bundleItemsInMarket_bundleListingId_listingsInMarket_id"
	}),
	bundleItemsInMarkets_itemListingId: many(bundleItemsInMarket, {
		relationName: "bundleItemsInMarket_itemListingId_listingsInMarket_id"
	}),
}));

export const cookieConsentsInComplianceRelations = relations(cookieConsentsInCompliance, ({one}) => ({
	usersInIam: one(usersInIam, {
		fields: [cookieConsentsInCompliance.userId],
		references: [usersInIam.id]
	}),
}));

export const plansInBillingRelations = relations(plansInBilling, ({one, many}) => ({
	plansInBilling: one(plansInBilling, {
		fields: [plansInBilling.basePlanId],
		references: [plansInBilling.id],
		relationName: "plansInBilling_basePlanId_plansInBilling_id"
	}),
	plansInBillings: many(plansInBilling, {
		relationName: "plansInBilling_basePlanId_plansInBilling_id"
	}),
	planPricesInBillings: many(planPricesInBilling),
	infraMeterRatesInBillings: many(infraMeterRatesInBilling),
	subscriptionsInBillings: many(subscriptionsInBilling),
	subscriptionEventsInBillings_fromPlanId: many(subscriptionEventsInBilling, {
		relationName: "subscriptionEventsInBilling_fromPlanId_plansInBilling_id"
	}),
	subscriptionEventsInBillings_toPlanId: many(subscriptionEventsInBilling, {
		relationName: "subscriptionEventsInBilling_toPlanId_plansInBilling_id"
	}),
	planFeaturesInBillings: many(planFeaturesInBilling),
}));

export const planPricesInBillingRelations = relations(planPricesInBilling, ({one, many}) => ({
	currenciesInRef: one(currenciesInRef, {
		fields: [planPricesInBilling.currency],
		references: [currenciesInRef.code]
	}),
	plansInBilling: one(plansInBilling, {
		fields: [planPricesInBilling.planId],
		references: [plansInBilling.id]
	}),
	subscriptionsInBillings: many(subscriptionsInBilling),
}));

export const creditPackPricesInBillingRelations = relations(creditPackPricesInBilling, ({one}) => ({
	currenciesInRef: one(currenciesInRef, {
		fields: [creditPackPricesInBilling.currency],
		references: [currenciesInRef.code]
	}),
	creditPacksInBilling: one(creditPacksInBilling, {
		fields: [creditPackPricesInBilling.packId],
		references: [creditPacksInBilling.id]
	}),
}));

export const creditPacksInBillingRelations = relations(creditPacksInBilling, ({many}) => ({
	creditPackPricesInBillings: many(creditPackPricesInBilling),
}));

export const infraMeterRatesInBillingRelations = relations(infraMeterRatesInBilling, ({one}) => ({
	infraMetersInBilling: one(infraMetersInBilling, {
		fields: [infraMeterRatesInBilling.meterId],
		references: [infraMetersInBilling.id]
	}),
	plansInBilling: one(plansInBilling, {
		fields: [infraMeterRatesInBilling.planId],
		references: [plansInBilling.id]
	}),
}));

export const infraMetersInBillingRelations = relations(infraMetersInBilling, ({many}) => ({
	infraMeterRatesInBillings: many(infraMeterRatesInBilling),
}));

export const modelDeploymentsInAiRelations = relations(modelDeploymentsInAi, ({one, many}) => ({
	modelsInAi: one(modelsInAi, {
		fields: [modelDeploymentsInAi.modelId],
		references: [modelsInAi.id]
	}),
	providerAccountsInAi: one(providerAccountsInAi, {
		fields: [modelDeploymentsInAi.providerAccountId],
		references: [providerAccountsInAi.id]
	}),
	providersInAi: one(providersInAi, {
		fields: [modelDeploymentsInAi.providerId],
		references: [providersInAi.id]
	}),
	modelPricesInAis: many(modelPricesInAi),
}));

export const modelsInAiRelations = relations(modelsInAi, ({many}) => ({
	modelDeploymentsInAis: many(modelDeploymentsInAi),
	guardrailDetectorsInAis: many(guardrailDetectorsInAi),
	capabilityVersionsInAis: many(capabilityVersionsInAi),
	versionsInAgents: many(versionsInAgent),
	routingRuleTargetsInAis: many(routingRuleTargetsInAi),
}));

export const providerAccountsInAiRelations = relations(providerAccountsInAi, ({one, many}) => ({
	modelDeploymentsInAis: many(modelDeploymentsInAi),
	currenciesInRef: one(currenciesInRef, {
		fields: [providerAccountsInAi.balanceCurrency],
		references: [currenciesInRef.code]
	}),
	providersInAi: one(providersInAi, {
		fields: [providerAccountsInAi.providerId],
		references: [providersInAi.id]
	}),
	secretsInIam: one(secretsInIam, {
		fields: [providerAccountsInAi.secretId],
		references: [secretsInIam.id]
	}),
	providerAccountSnapshotsInAis: many(providerAccountSnapshotsInAi),
}));

export const providersInAiRelations = relations(providersInAi, ({many}) => ({
	modelDeploymentsInAis: many(modelDeploymentsInAi),
	providerAccountsInAis: many(providerAccountsInAi),
	byokKeysInAis: many(byokKeysInAi),
}));

export const modelPricesInAiRelations = relations(modelPricesInAi, ({one}) => ({
	modelDeploymentsInAi: one(modelDeploymentsInAi, {
		fields: [modelPricesInAi.deploymentId],
		references: [modelDeploymentsInAi.id]
	}),
}));

export const connectorDefinitionsInMcpRelations = relations(connectorDefinitionsInMcp, ({one, many}) => ({
	filesInStorage: one(filesInStorage, {
		fields: [connectorDefinitionsInMcp.iconFileId],
		references: [filesInStorage.id]
	}),
	connectorsInMcps: many(connectorsInMcp),
}));

export const filesInStorageRelations = relations(filesInStorage, ({one, many}) => ({
	connectorDefinitionsInMcps: many(connectorDefinitionsInMcp),
	legalDocumentsInCompliances: many(legalDocumentsInCompliance),
	transferAuthorizationsInCompliances: many(transferAuthorizationsInCompliance),
	usersInIam_avatarFileId: many(usersInIam, {
		relationName: "usersInIam_avatarFileId_filesInStorage_id"
	}),
	backendsInStorage: one(backendsInStorage, {
		fields: [filesInStorage.backendId],
		references: [backendsInStorage.id]
	}),
	dataRegionsInRef: one(dataRegionsInRef, {
		fields: [filesInStorage.dataRegionId],
		references: [dataRegionsInRef.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [filesInStorage.organizationId],
		references: [organizationsInIam.id]
	}),
	usersInIam_uploadedByUserId: one(usersInIam, {
		fields: [filesInStorage.uploadedByUserId],
		references: [usersInIam.id],
		relationName: "filesInStorage_uploadedByUserId_usersInIam_id"
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [filesInStorage.organizationId],
		references: [workspacesInIam.id]
	}),
	invoicesInBillings: many(invoicesInBilling),
	evalDatasetsInAis: many(evalDatasetsInAi),
	connectorSourcesInMcps: many(connectorSourcesInMcp),
	fileDatasetsInMcps: many(fileDatasetsInMcp),
	publishersInMarkets: many(publishersInMarket),
	listingsInMarkets: many(listingsInMarket),
	dataSubjectRequestsInCompliances: many(dataSubjectRequestsInCompliance),
}));

export const categoriesInMarketRelations = relations(categoriesInMarket, ({one, many}) => ({
	categoriesInMarket: one(categoriesInMarket, {
		fields: [categoriesInMarket.parentId],
		references: [categoriesInMarket.id],
		relationName: "categoriesInMarket_parentId_categoriesInMarket_id"
	}),
	categoriesInMarkets: many(categoriesInMarket, {
		relationName: "categoriesInMarket_parentId_categoriesInMarket_id"
	}),
	listingsInMarkets: many(listingsInMarket),
}));

export const legalDocumentsInComplianceRelations = relations(legalDocumentsInCompliance, ({one, many}) => ({
	filesInStorage: one(filesInStorage, {
		fields: [legalDocumentsInCompliance.fileId],
		references: [filesInStorage.id]
	}),
	languagesInRef: one(languagesInRef, {
		fields: [legalDocumentsInCompliance.locale],
		references: [languagesInRef.code]
	}),
	legalAcceptancesInCompliances: many(legalAcceptancesInCompliance),
}));

export const couponsInBillingRelations = relations(couponsInBilling, ({one, many}) => ({
	currenciesInRef: one(currenciesInRef, {
		fields: [couponsInBilling.currency],
		references: [currenciesInRef.code]
	}),
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [couponsInBilling.createdByStaffId],
		references: [staffUsersInPlatform.id]
	}),
	couponRedemptionsInBillings: many(couponRedemptionsInBilling),
}));

export const guardrailDetectorsInAiRelations = relations(guardrailDetectorsInAi, ({one, many}) => ({
	modelsInAi: one(modelsInAi, {
		fields: [guardrailDetectorsInAi.modelId],
		references: [modelsInAi.id]
	}),
	guardrailRulesInAis: many(guardrailRulesInAi),
}));

export const providerAccountSnapshotsInAiRelations = relations(providerAccountSnapshotsInAi, ({one}) => ({
	currenciesInRef: one(currenciesInRef, {
		fields: [providerAccountSnapshotsInAi.currency],
		references: [currenciesInRef.code]
	}),
	providerAccountsInAi: one(providerAccountsInAi, {
		fields: [providerAccountSnapshotsInAi.providerAccountId],
		references: [providerAccountsInAi.id]
	}),
}));

export const dataBreachesInComplianceRelations = relations(dataBreachesInCompliance, ({one}) => ({
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [dataBreachesInCompliance.ownerStaffId],
		references: [staffUsersInPlatform.id]
	}),
}));

export const transferAuthorizationsInComplianceRelations = relations(transferAuthorizationsInCompliance, ({one}) => ({
	filesInStorage: one(filesInStorage, {
		fields: [transferAuthorizationsInCompliance.fileId],
		references: [filesInStorage.id]
	}),
}));

export const backendsInStorageRelations = relations(backendsInStorage, ({one, many}) => ({
	dataRegionsInRef: one(dataRegionsInRef, {
		fields: [backendsInStorage.dataRegionId],
		references: [dataRegionsInRef.id]
	}),
	backendMigrationsInStorages_fromBackendId: many(backendMigrationsInStorage, {
		relationName: "backendMigrationsInStorage_fromBackendId_backendsInStorage_id"
	}),
	backendMigrationsInStorages_toBackendId: many(backendMigrationsInStorage, {
		relationName: "backendMigrationsInStorage_toBackendId_backendsInStorage_id"
	}),
	filesInStorages: many(filesInStorage),
}));

export const backendMigrationsInStorageRelations = relations(backendMigrationsInStorage, ({one}) => ({
	backendsInStorage_fromBackendId: one(backendsInStorage, {
		fields: [backendMigrationsInStorage.fromBackendId],
		references: [backendsInStorage.id],
		relationName: "backendMigrationsInStorage_fromBackendId_backendsInStorage_id"
	}),
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [backendMigrationsInStorage.startedByStaffUserId],
		references: [staffUsersInPlatform.id]
	}),
	backendsInStorage_toBackendId: one(backendsInStorage, {
		fields: [backendMigrationsInStorage.toBackendId],
		references: [backendsInStorage.id],
		relationName: "backendMigrationsInStorage_toBackendId_backendsInStorage_id"
	}),
}));

export const featureFlagsInPlatformRelations = relations(featureFlagsInPlatform, ({one, many}) => ({
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [featureFlagsInPlatform.updatedByStaffId],
		references: [staffUsersInPlatform.id]
	}),
	featureFlagOverridesInPlatforms: many(featureFlagOverridesInPlatform),
}));

export const messageTemplatesInPlatformRelations = relations(messageTemplatesInPlatform, ({one}) => ({
	languagesInRef: one(languagesInRef, {
		fields: [messageTemplatesInPlatform.locale],
		references: [languagesInRef.code]
	}),
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [messageTemplatesInPlatform.updatedByStaffId],
		references: [staffUsersInPlatform.id]
	}),
}));

export const announcementsInPlatformRelations = relations(announcementsInPlatform, ({one, many}) => ({
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [announcementsInPlatform.createdByStaffId],
		references: [staffUsersInPlatform.id]
	}),
	announcementDismissalsInPlatforms: many(announcementDismissalsInPlatform),
}));

export const incidentsInPlatformRelations = relations(incidentsInPlatform, ({one, many}) => ({
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [incidentsInPlatform.createdByStaffId],
		references: [staffUsersInPlatform.id]
	}),
	incidentUpdatesInPlatforms: many(incidentUpdatesInPlatform),
}));

export const incidentUpdatesInPlatformRelations = relations(incidentUpdatesInPlatform, ({one}) => ({
	incidentsInPlatform: one(incidentsInPlatform, {
		fields: [incidentUpdatesInPlatform.incidentId],
		references: [incidentsInPlatform.id]
	}),
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [incidentUpdatesInPlatform.staffUserId],
		references: [staffUsersInPlatform.id]
	}),
}));

export const maintenanceWindowsInPlatformRelations = relations(maintenanceWindowsInPlatform, ({one}) => ({
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [maintenanceWindowsInPlatform.createdByStaffId],
		references: [staffUsersInPlatform.id]
	}),
	dataRegionsInRef: one(dataRegionsInRef, {
		fields: [maintenanceWindowsInPlatform.dataRegionId],
		references: [dataRegionsInRef.id]
	}),
}));

export const rateLimitPoliciesInPlatformRelations = relations(rateLimitPoliciesInPlatform, ({one}) => ({
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [rateLimitPoliciesInPlatform.updatedByStaffId],
		references: [staffUsersInPlatform.id]
	}),
}));

export const emergencyStopsInPlatformRelations = relations(emergencyStopsInPlatform, ({one}) => ({
	staffUsersInPlatform_activatedByStaffId: one(staffUsersInPlatform, {
		fields: [emergencyStopsInPlatform.activatedByStaffId],
		references: [staffUsersInPlatform.id],
		relationName: "emergencyStopsInPlatform_activatedByStaffId_staffUsersInPlatform_id"
	}),
	staffUsersInPlatform_deactivatedByStaffId: one(staffUsersInPlatform, {
		fields: [emergencyStopsInPlatform.deactivatedByStaffId],
		references: [staffUsersInPlatform.id],
		relationName: "emergencyStopsInPlatform_deactivatedByStaffId_staffUsersInPlatform_id"
	}),
}));

export const userSessionsInIamRelations = relations(userSessionsInIam, ({one}) => ({
	usersInIam: one(usersInIam, {
		fields: [userSessionsInIam.userId],
		references: [usersInIam.id]
	}),
}));

export const blocklistEntriesInPlatformRelations = relations(blocklistEntriesInPlatform, ({one}) => ({
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [blocklistEntriesInPlatform.createdByStaffId],
		references: [staffUsersInPlatform.id]
	}),
}));

export const routingRulesInAiRelations = relations(routingRulesInAi, ({one, many}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [routingRulesInAi.organizationId],
		references: [organizationsInIam.id]
	}),
	routingProfilesInAi: one(routingProfilesInAi, {
		fields: [routingRulesInAi.profileId],
		references: [routingProfilesInAi.id]
	}),
	routingRuleTargetsInAis: many(routingRuleTargetsInAi),
}));

export const routingProfilesInAiRelations = relations(routingProfilesInAi, ({one, many}) => ({
	routingRulesInAis: many(routingRulesInAi),
	workspacesInIam: many(workspacesInIam),
	organizationsInIam_organizationId: one(organizationsInIam, {
		fields: [routingProfilesInAi.organizationId],
		references: [organizationsInIam.id],
		relationName: "routingProfilesInAi_organizationId_organizationsInIam_id"
	}),
	capabilityVersionsInAis: many(capabilityVersionsInAi),
	versionsInAgents: many(versionsInAgent),
	organizationsInIam_defaultRoutingProfileId: many(organizationsInIam, {
		relationName: "organizationsInIam_defaultRoutingProfileId_routingProfilesInAi_id"
	}),
}));

export const byokKeysInAiRelations = relations(byokKeysInAi, ({one}) => ({
	usersInIam: one(usersInIam, {
		fields: [byokKeysInAi.createdByUserId],
		references: [usersInIam.id]
	}),
	environmentsInIam: one(environmentsInIam, {
		fields: [byokKeysInAi.organizationId],
		references: [environmentsInIam.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [byokKeysInAi.organizationId],
		references: [organizationsInIam.id]
	}),
	providersInAi: one(providersInAi, {
		fields: [byokKeysInAi.providerId],
		references: [providersInAi.id]
	}),
	secretsInIam: one(secretsInIam, {
		fields: [byokKeysInAi.organizationId],
		references: [secretsInIam.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [byokKeysInAi.organizationId],
		references: [workspacesInIam.id]
	}),
}));

export const environmentsInIamRelations = relations(environmentsInIam, ({one, many}) => ({
	byokKeysInAis: many(byokKeysInAi),
	workspacesInIam: one(workspacesInIam, {
		fields: [environmentsInIam.organizationId],
		references: [workspacesInIam.id]
	}),
	secretsInIam: many(secretsInIam),
	capabilityReleasesInAis: many(capabilityReleasesInAi),
	connectorCredentialsInMcps: many(connectorCredentialsInMcp),
	accessTokensInMcps: many(accessTokensInMcp),
	oauthConsentsInIam: many(oauthConsentsInIam),
	triggersInAgents: many(triggersInAgent),
	conversationsInAgents: many(conversationsInAgent),
	apiKeysInDevs: many(apiKeysInDev),
	webhookEndpointsInDevs: many(webhookEndpointsInDev),
	webhookSubscriptionsInDevs: many(webhookSubscriptionsInDev),
}));

export const workspacesInIamRelations = relations(workspacesInIam, ({one, many}) => ({
	byokKeysInAis: many(byokKeysInAi),
	capabilitiesInAis: many(capabilitiesInAi),
	usersInIam: one(usersInIam, {
		fields: [workspacesInIam.createdByUserId],
		references: [usersInIam.id]
	}),
	dataRegionsInRef: one(dataRegionsInRef, {
		fields: [workspacesInIam.dataRegionId],
		references: [dataRegionsInRef.id]
	}),
	routingProfilesInAi: one(routingProfilesInAi, {
		fields: [workspacesInIam.defaultRoutingProfileId],
		references: [routingProfilesInAi.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [workspacesInIam.organizationId],
		references: [organizationsInIam.id]
	}),
	environmentsInIam: many(environmentsInIam),
	projectsInIam: many(projectsInIam),
	filesInStorages: many(filesInStorage),
	creditWalletsInBillings: many(creditWalletsInBilling),
	secretsInIam: many(secretsInIam),
	evalDatasetsInAis: many(evalDatasetsInAi),
	bridgesInMcps: many(bridgesInMcp),
	connectorsInMcps: many(connectorsInMcp),
	serversInMcps: many(serversInMcp),
	agentsInAgents: many(agentsInAgent),
	approvalsInAgents: many(approvalsInAgent),
	memoriesInAgents: many(memoriesInAgent),
	conversationsInAgents: many(conversationsInAgent),
	apiKeysInDevs: many(apiKeysInDev),
	endUsersInDevs: many(endUsersInDev),
	webhookEndpointsInDevs: many(webhookEndpointsInDev),
	webhookSubscriptionsInDevs: many(webhookSubscriptionsInDev),
	installationsInMarkets: many(installationsInMarket),
	userPreferencesInUxes: many(userPreferencesInUx),
	draftsInUxes: many(draftsInUx),
	dashboardsInUxes: many(dashboardsInUx),
	workspaceMembersInIam: many(workspaceMembersInIam),
}));

export const capabilitiesInAiRelations = relations(capabilitiesInAi, ({one, many}) => ({
	usersInIam: one(usersInIam, {
		fields: [capabilitiesInAi.createdByUserId],
		references: [usersInIam.id]
	}),
	listingsInMarket: one(listingsInMarket, {
		fields: [capabilitiesInAi.sourceListingId],
		references: [listingsInMarket.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [capabilitiesInAi.organizationId],
		references: [workspacesInIam.id]
	}),
	capabilityVersionsInAis: many(capabilityVersionsInAi),
	capabilityReleasesInAis: many(capabilityReleasesInAi),
	evalDatasetsInAis: many(evalDatasetsInAi),
	capabilityGrantsInAgents: many(capabilityGrantsInAgent),
}));

export const rolesInIamRelations = relations(rolesInIam, ({one, many}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [rolesInIam.organizationId],
		references: [organizationsInIam.id]
	}),
	membershipsInIam: many(membershipsInIam),
	invitationsInIam: many(invitationsInIam),
	rolePermissionsInIam: many(rolePermissionsInIam),
	workspaceMembersInIam: many(workspaceMembersInIam),
}));

export const membershipsInIamRelations = relations(membershipsInIam, ({one, many}) => ({
	usersInIam_invitedByUserId: one(usersInIam, {
		fields: [membershipsInIam.invitedByUserId],
		references: [usersInIam.id],
		relationName: "membershipsInIam_invitedByUserId_usersInIam_id"
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [membershipsInIam.organizationId],
		references: [organizationsInIam.id]
	}),
	rolesInIam: one(rolesInIam, {
		fields: [membershipsInIam.roleId],
		references: [rolesInIam.id]
	}),
	usersInIam_userId: one(usersInIam, {
		fields: [membershipsInIam.userId],
		references: [usersInIam.id],
		relationName: "membershipsInIam_userId_usersInIam_id"
	}),
	teamMembersInIam: many(teamMembersInIam),
	workspaceMembersInIam: many(workspaceMembersInIam),
}));

export const invitationsInIamRelations = relations(invitationsInIam, ({one}) => ({
	usersInIam: one(usersInIam, {
		fields: [invitationsInIam.invitedByUserId],
		references: [usersInIam.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [invitationsInIam.organizationId],
		references: [organizationsInIam.id]
	}),
	rolesInIam: one(rolesInIam, {
		fields: [invitationsInIam.roleId],
		references: [rolesInIam.id]
	}),
}));

export const teamsInIamRelations = relations(teamsInIam, ({one, many}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [teamsInIam.organizationId],
		references: [organizationsInIam.id]
	}),
	teamMembersInIam: many(teamMembersInIam),
}));

export const projectsInIamRelations = relations(projectsInIam, ({one, many}) => ({
	workspacesInIam: one(workspacesInIam, {
		fields: [projectsInIam.organizationId],
		references: [workspacesInIam.id]
	}),
	apiKeysInDevs: many(apiKeysInDev),
}));

export const subscriptionsInBillingRelations = relations(subscriptionsInBilling, ({one, many}) => ({
	currenciesInRef: one(currenciesInRef, {
		fields: [subscriptionsInBilling.currency],
		references: [currenciesInRef.code]
	}),
	paymentMethodsInBilling: one(paymentMethodsInBilling, {
		fields: [subscriptionsInBilling.defaultPaymentMethodId],
		references: [paymentMethodsInBilling.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [subscriptionsInBilling.organizationId],
		references: [organizationsInIam.id]
	}),
	plansInBilling: one(plansInBilling, {
		fields: [subscriptionsInBilling.planId],
		references: [plansInBilling.id]
	}),
	planPricesInBilling: one(planPricesInBilling, {
		fields: [subscriptionsInBilling.planPriceId],
		references: [planPricesInBilling.id]
	}),
	subscriptionEventsInBillings: many(subscriptionEventsInBilling),
	invoicesInBillings: many(invoicesInBilling),
}));

export const subscriptionEventsInBillingRelations = relations(subscriptionEventsInBilling, ({one}) => ({
	plansInBilling_fromPlanId: one(plansInBilling, {
		fields: [subscriptionEventsInBilling.fromPlanId],
		references: [plansInBilling.id],
		relationName: "subscriptionEventsInBilling_fromPlanId_plansInBilling_id"
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [subscriptionEventsInBilling.organizationId],
		references: [organizationsInIam.id]
	}),
	subscriptionsInBilling: one(subscriptionsInBilling, {
		fields: [subscriptionEventsInBilling.subscriptionId],
		references: [subscriptionsInBilling.id]
	}),
	plansInBilling_toPlanId: one(plansInBilling, {
		fields: [subscriptionEventsInBilling.toPlanId],
		references: [plansInBilling.id],
		relationName: "subscriptionEventsInBilling_toPlanId_plansInBilling_id"
	}),
}));

export const creditWalletsInBillingRelations = relations(creditWalletsInBilling, ({one, many}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [creditWalletsInBilling.organizationId],
		references: [organizationsInIam.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [creditWalletsInBilling.organizationId],
		references: [workspacesInIam.id]
	}),
	creditGrantsInBillings: many(creditGrantsInBilling),
	creditReservationsInBillings: many(creditReservationsInBilling),
	creditLedgerDefaultInBillings: many(creditLedgerDefaultInBilling),
	creditLedgerP202609InBillings: many(creditLedgerP202609InBilling),
	creditLedgerP202610InBillings: many(creditLedgerP202610InBilling),
	creditLedgerP202611InBillings: many(creditLedgerP202611InBilling),
	creditLedgerP202612InBillings: many(creditLedgerP202612InBilling),
}));

export const creditReservationsInBillingRelations = relations(creditReservationsInBilling, ({one}) => ({
	creditWalletsInBilling: one(creditWalletsInBilling, {
		fields: [creditReservationsInBilling.organizationId],
		references: [creditWalletsInBilling.id]
	}),
}));

export const invoicesInBillingRelations = relations(invoicesInBilling, ({one, many}) => ({
	invoicesInBilling: one(invoicesInBilling, {
		fields: [invoicesInBilling.correctsInvoiceId],
		references: [invoicesInBilling.id],
		relationName: "invoicesInBilling_correctsInvoiceId_invoicesInBilling_id"
	}),
	invoicesInBillings: many(invoicesInBilling, {
		relationName: "invoicesInBilling_correctsInvoiceId_invoicesInBilling_id"
	}),
	currenciesInRef: one(currenciesInRef, {
		fields: [invoicesInBilling.currency],
		references: [currenciesInRef.code]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [invoicesInBilling.organizationId],
		references: [organizationsInIam.id]
	}),
	filesInStorage: one(filesInStorage, {
		fields: [invoicesInBilling.pdfFileId],
		references: [filesInStorage.id]
	}),
	subscriptionsInBilling: one(subscriptionsInBilling, {
		fields: [invoicesInBilling.subscriptionId],
		references: [subscriptionsInBilling.id]
	}),
	invoiceLinesInBillings: many(invoiceLinesInBilling),
	paymentsInBillings: many(paymentsInBilling),
	couponRedemptionsInBillings: many(couponRedemptionsInBilling),
}));

export const refundsInBillingRelations = relations(refundsInBilling, ({one}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [refundsInBilling.organizationId],
		references: [organizationsInIam.id]
	}),
	paymentsInBilling: one(paymentsInBilling, {
		fields: [refundsInBilling.paymentId],
		references: [paymentsInBilling.id]
	}),
}));

export const budgetsInBillingRelations = relations(budgetsInBilling, ({one, many}) => ({
	usersInIam: one(usersInIam, {
		fields: [budgetsInBilling.createdByUserId],
		references: [usersInIam.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [budgetsInBilling.organizationId],
		references: [organizationsInIam.id]
	}),
	budgetPeriodsInBillings: many(budgetPeriodsInBilling),
}));

export const budgetPeriodsInBillingRelations = relations(budgetPeriodsInBilling, ({one}) => ({
	budgetsInBilling: one(budgetsInBilling, {
		fields: [budgetPeriodsInBilling.budgetId],
		references: [budgetsInBilling.id]
	}),
}));

export const couponRedemptionsInBillingRelations = relations(couponRedemptionsInBilling, ({one}) => ({
	couponsInBilling: one(couponsInBilling, {
		fields: [couponRedemptionsInBilling.couponId],
		references: [couponsInBilling.id]
	}),
	creditGrantsInBilling: one(creditGrantsInBilling, {
		fields: [couponRedemptionsInBilling.creditGrantId],
		references: [creditGrantsInBilling.id]
	}),
	invoicesInBilling: one(invoicesInBilling, {
		fields: [couponRedemptionsInBilling.invoiceId],
		references: [invoicesInBilling.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [couponRedemptionsInBilling.organizationId],
		references: [organizationsInIam.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [couponRedemptionsInBilling.userId],
		references: [usersInIam.id]
	}),
}));

export const capabilityVersionsInAiRelations = relations(capabilityVersionsInAi, ({one, many}) => ({
	capabilitiesInAi: one(capabilitiesInAi, {
		fields: [capabilityVersionsInAi.capabilityId],
		references: [capabilitiesInAi.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [capabilityVersionsInAi.createdByUserId],
		references: [usersInIam.id]
	}),
	modelsInAi: one(modelsInAi, {
		fields: [capabilityVersionsInAi.modelOverrideId],
		references: [modelsInAi.id]
	}),
	routingProfilesInAi: one(routingProfilesInAi, {
		fields: [capabilityVersionsInAi.routingProfileId],
		references: [routingProfilesInAi.id]
	}),
	evalRunsInAis: many(evalRunsInAi),
	capabilityReleaseVariantsInAis: many(capabilityReleaseVariantsInAi),
}));

export const capabilityReleasesInAiRelations = relations(capabilityReleasesInAi, ({one, many}) => ({
	capabilitiesInAi: one(capabilitiesInAi, {
		fields: [capabilityReleasesInAi.capabilityId],
		references: [capabilitiesInAi.id]
	}),
	environmentsInIam: one(environmentsInIam, {
		fields: [capabilityReleasesInAi.organizationId],
		references: [environmentsInIam.id]
	}),
	evalRunsInAi: one(evalRunsInAi, {
		fields: [capabilityReleasesInAi.organizationId],
		references: [evalRunsInAi.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [capabilityReleasesInAi.releasedByUserId],
		references: [usersInIam.id]
	}),
	capabilityReleaseVariantsInAis: many(capabilityReleaseVariantsInAi),
}));

export const evalRunsInAiRelations = relations(evalRunsInAi, ({one, many}) => ({
	capabilityReleasesInAis: many(capabilityReleasesInAi),
	capabilityVersionsInAi: one(capabilityVersionsInAi, {
		fields: [evalRunsInAi.organizationId],
		references: [capabilityVersionsInAi.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [evalRunsInAi.createdByUserId],
		references: [usersInIam.id]
	}),
	evalDatasetsInAi: one(evalDatasetsInAi, {
		fields: [evalRunsInAi.organizationId],
		references: [evalDatasetsInAi.id]
	}),
	evalResultsInAis: many(evalResultsInAi),
}));

export const evalDatasetsInAiRelations = relations(evalDatasetsInAi, ({one, many}) => ({
	capabilitiesInAi: one(capabilitiesInAi, {
		fields: [evalDatasetsInAi.organizationId],
		references: [capabilitiesInAi.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [evalDatasetsInAi.createdByUserId],
		references: [usersInIam.id]
	}),
	filesInStorage: one(filesInStorage, {
		fields: [evalDatasetsInAi.sourceFileId],
		references: [filesInStorage.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [evalDatasetsInAi.organizationId],
		references: [workspacesInIam.id]
	}),
	evalCasesInAis: many(evalCasesInAi),
	evalRunsInAis: many(evalRunsInAi),
}));

export const evalCasesInAiRelations = relations(evalCasesInAi, ({one, many}) => ({
	evalDatasetsInAi: one(evalDatasetsInAi, {
		fields: [evalCasesInAi.datasetId],
		references: [evalDatasetsInAi.id]
	}),
	evalResultsInAis: many(evalResultsInAi),
}));

export const oauthConnectionsInMcpRelations = relations(oauthConnectionsInMcp, ({one, many}) => ({
	secretsInIam_organizationId: one(secretsInIam, {
		fields: [oauthConnectionsInMcp.organizationId],
		references: [secretsInIam.id],
		relationName: "oauthConnectionsInMcp_organizationId_secretsInIam_id"
	}),
	usersInIam: one(usersInIam, {
		fields: [oauthConnectionsInMcp.connectedByUserId],
		references: [usersInIam.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [oauthConnectionsInMcp.organizationId],
		references: [organizationsInIam.id]
	}),
	secretsInIam_organizationId: one(secretsInIam, {
		fields: [oauthConnectionsInMcp.organizationId],
		references: [secretsInIam.id],
		relationName: "oauthConnectionsInMcp_organizationId_secretsInIam_id"
	}),
	connectorCredentialsInMcps: many(connectorCredentialsInMcp),
}));

export const bridgesInMcpRelations = relations(bridgesInMcp, ({one, many}) => ({
	usersInIam: one(usersInIam, {
		fields: [bridgesInMcp.createdByUserId],
		references: [usersInIam.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [bridgesInMcp.organizationId],
		references: [workspacesInIam.id]
	}),
	connectorsInMcps: many(connectorsInMcp),
}));

export const connectorsInMcpRelations = relations(connectorsInMcp, ({one, many}) => ({
	bridgesInMcp: one(bridgesInMcp, {
		fields: [connectorsInMcp.organizationId],
		references: [bridgesInMcp.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [connectorsInMcp.createdByUserId],
		references: [usersInIam.id]
	}),
	connectorDefinitionsInMcp: one(connectorDefinitionsInMcp, {
		fields: [connectorsInMcp.definitionId],
		references: [connectorDefinitionsInMcp.id]
	}),
	listingsInMarket: one(listingsInMarket, {
		fields: [connectorsInMcp.sourceListingId],
		references: [listingsInMarket.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [connectorsInMcp.organizationId],
		references: [workspacesInIam.id]
	}),
	connectorCredentialsInMcps: many(connectorCredentialsInMcp),
	connectorSourcesInMcps: many(connectorSourcesInMcp),
	connectorActionsInMcps: many(connectorActionsInMcp),
	fileDatasetsInMcps: many(fileDatasetsInMcp),
	webhookEndpointsInDevs: many(webhookEndpointsInDev),
}));

export const connectorCredentialsInMcpRelations = relations(connectorCredentialsInMcp, ({one}) => ({
	connectorsInMcp: one(connectorsInMcp, {
		fields: [connectorCredentialsInMcp.connectorId],
		references: [connectorsInMcp.id]
	}),
	environmentsInIam: one(environmentsInIam, {
		fields: [connectorCredentialsInMcp.organizationId],
		references: [environmentsInIam.id]
	}),
	oauthConnectionsInMcp: one(oauthConnectionsInMcp, {
		fields: [connectorCredentialsInMcp.organizationId],
		references: [oauthConnectionsInMcp.id]
	}),
	secretsInIam: one(secretsInIam, {
		fields: [connectorCredentialsInMcp.organizationId],
		references: [secretsInIam.id]
	}),
}));

export const connectorSourcesInMcpRelations = relations(connectorSourcesInMcp, ({one}) => ({
	connectorsInMcp: one(connectorsInMcp, {
		fields: [connectorSourcesInMcp.connectorId],
		references: [connectorsInMcp.id]
	}),
	filesInStorage: one(filesInStorage, {
		fields: [connectorSourcesInMcp.fileId],
		references: [filesInStorage.id]
	}),
}));

export const connectorActionsInMcpRelations = relations(connectorActionsInMcp, ({one, many}) => ({
	connectorsInMcp: one(connectorsInMcp, {
		fields: [connectorActionsInMcp.connectorId],
		references: [connectorsInMcp.id]
	}),
	toolsInMcps: many(toolsInMcp),
	resourcesInMcps: many(resourcesInMcp),
}));

export const fileDatasetsInMcpRelations = relations(fileDatasetsInMcp, ({one}) => ({
	connectorsInMcp: one(connectorsInMcp, {
		fields: [fileDatasetsInMcp.connectorId],
		references: [connectorsInMcp.id]
	}),
	filesInStorage: one(filesInStorage, {
		fields: [fileDatasetsInMcp.fileId],
		references: [filesInStorage.id]
	}),
}));

export const serversInMcpRelations = relations(serversInMcp, ({one, many}) => ({
	serverVersionsInMcp: one(serverVersionsInMcp, {
		fields: [serversInMcp.activeVersionId],
		references: [serverVersionsInMcp.id],
		relationName: "serversInMcp_activeVersionId_serverVersionsInMcp_id"
	}),
	usersInIam: one(usersInIam, {
		fields: [serversInMcp.createdByUserId],
		references: [usersInIam.id]
	}),
	listingsInMarket: one(listingsInMarket, {
		fields: [serversInMcp.sourceListingId],
		references: [listingsInMarket.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [serversInMcp.organizationId],
		references: [workspacesInIam.id]
	}),
	serverVersionsInMcps: many(serverVersionsInMcp, {
		relationName: "serverVersionsInMcp_serverId_serversInMcp_id"
	}),
	toolsInMcps: many(toolsInMcp),
	resourcesInMcps: many(resourcesInMcp),
	promptsInMcps: many(promptsInMcp),
	accessTokensInMcps: many(accessTokensInMcp),
	oauthConsentsInIam: many(oauthConsentsInIam),
	oauthTokensInIam: many(oauthTokensInIam),
	toolGrantsInAgents: many(toolGrantsInAgent),
	approvalsInAgents: many(approvalsInAgent),
}));

export const serverVersionsInMcpRelations = relations(serverVersionsInMcp, ({one, many}) => ({
	serversInMcps: many(serversInMcp, {
		relationName: "serversInMcp_activeVersionId_serverVersionsInMcp_id"
	}),
	usersInIam: one(usersInIam, {
		fields: [serverVersionsInMcp.publishedByUserId],
		references: [usersInIam.id]
	}),
	serversInMcp: one(serversInMcp, {
		fields: [serverVersionsInMcp.serverId],
		references: [serversInMcp.id],
		relationName: "serverVersionsInMcp_serverId_serversInMcp_id"
	}),
	toolGrantsInAgents: many(toolGrantsInAgent),
}));

export const toolsInMcpRelations = relations(toolsInMcp, ({one, many}) => ({
	connectorActionsInMcp: one(connectorActionsInMcp, {
		fields: [toolsInMcp.organizationId],
		references: [connectorActionsInMcp.id]
	}),
	serversInMcp: one(serversInMcp, {
		fields: [toolsInMcp.serverId],
		references: [serversInMcp.id]
	}),
	toolEmbeddingsInMcps: many(toolEmbeddingsInMcp),
	toolGrantsInAgents: many(toolGrantsInAgent),
	approvalsInAgents: many(approvalsInAgent),
	accessTokenToolsInMcps: many(accessTokenToolsInMcp),
}));

export const toolEmbeddingsInMcpRelations = relations(toolEmbeddingsInMcp, ({one}) => ({
	toolsInMcp: one(toolsInMcp, {
		fields: [toolEmbeddingsInMcp.toolId],
		references: [toolsInMcp.id]
	}),
}));

export const resourcesInMcpRelations = relations(resourcesInMcp, ({one}) => ({
	connectorActionsInMcp: one(connectorActionsInMcp, {
		fields: [resourcesInMcp.organizationId],
		references: [connectorActionsInMcp.id]
	}),
	serversInMcp: one(serversInMcp, {
		fields: [resourcesInMcp.serverId],
		references: [serversInMcp.id]
	}),
}));

export const promptsInMcpRelations = relations(promptsInMcp, ({one}) => ({
	serversInMcp: one(serversInMcp, {
		fields: [promptsInMcp.serverId],
		references: [serversInMcp.id]
	}),
}));

export const accessTokensInMcpRelations = relations(accessTokensInMcp, ({one, many}) => ({
	usersInIam_createdByUserId: one(usersInIam, {
		fields: [accessTokensInMcp.createdByUserId],
		references: [usersInIam.id],
		relationName: "accessTokensInMcp_createdByUserId_usersInIam_id"
	}),
	environmentsInIam: one(environmentsInIam, {
		fields: [accessTokensInMcp.organizationId],
		references: [environmentsInIam.id]
	}),
	usersInIam_revokedByUserId: one(usersInIam, {
		fields: [accessTokensInMcp.revokedByUserId],
		references: [usersInIam.id],
		relationName: "accessTokensInMcp_revokedByUserId_usersInIam_id"
	}),
	serversInMcp: one(serversInMcp, {
		fields: [accessTokensInMcp.serverId],
		references: [serversInMcp.id]
	}),
	accessTokenToolsInMcps: many(accessTokenToolsInMcp),
}));

export const healthChecksInMcpRelations = relations(healthChecksInMcp, ({one}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [healthChecksInMcp.organizationId],
		references: [organizationsInIam.id]
	}),
}));

export const oauthConsentsInIamRelations = relations(oauthConsentsInIam, ({one, many}) => ({
	oauthClientsInIam: one(oauthClientsInIam, {
		fields: [oauthConsentsInIam.clientId],
		references: [oauthClientsInIam.id]
	}),
	environmentsInIam: one(environmentsInIam, {
		fields: [oauthConsentsInIam.organizationId],
		references: [environmentsInIam.id]
	}),
	serversInMcp: one(serversInMcp, {
		fields: [oauthConsentsInIam.organizationId],
		references: [serversInMcp.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [oauthConsentsInIam.userId],
		references: [usersInIam.id]
	}),
	oauthAuthorizationCodesInIam: many(oauthAuthorizationCodesInIam),
	oauthTokensInIam: many(oauthTokensInIam),
}));

export const oauthClientsInIamRelations = relations(oauthClientsInIam, ({many}) => ({
	oauthConsentsInIam: many(oauthConsentsInIam),
	oauthAuthorizationCodesInIam: many(oauthAuthorizationCodesInIam),
	oauthTokensInIam: many(oauthTokensInIam),
}));

export const oauthAuthorizationCodesInIamRelations = relations(oauthAuthorizationCodesInIam, ({one}) => ({
	oauthClientsInIam: one(oauthClientsInIam, {
		fields: [oauthAuthorizationCodesInIam.clientId],
		references: [oauthClientsInIam.id]
	}),
	oauthConsentsInIam: one(oauthConsentsInIam, {
		fields: [oauthAuthorizationCodesInIam.consentId],
		references: [oauthConsentsInIam.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [oauthAuthorizationCodesInIam.organizationId],
		references: [organizationsInIam.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [oauthAuthorizationCodesInIam.userId],
		references: [usersInIam.id]
	}),
}));

export const oauthTokensInIamRelations = relations(oauthTokensInIam, ({one, many}) => ({
	oauthClientsInIam: one(oauthClientsInIam, {
		fields: [oauthTokensInIam.clientId],
		references: [oauthClientsInIam.id]
	}),
	oauthConsentsInIam: one(oauthConsentsInIam, {
		fields: [oauthTokensInIam.consentId],
		references: [oauthConsentsInIam.id]
	}),
	serversInMcp: one(serversInMcp, {
		fields: [oauthTokensInIam.organizationId],
		references: [serversInMcp.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [oauthTokensInIam.organizationId],
		references: [organizationsInIam.id]
	}),
	oauthTokensInIam_parentTokenId: one(oauthTokensInIam, {
		fields: [oauthTokensInIam.parentTokenId],
		references: [oauthTokensInIam.id],
		relationName: "oauthTokensInIam_parentTokenId_oauthTokensInIam_id"
	}),
	oauthTokensInIam_parentTokenId: many(oauthTokensInIam, {
		relationName: "oauthTokensInIam_parentTokenId_oauthTokensInIam_id"
	}),
	usersInIam: one(usersInIam, {
		fields: [oauthTokensInIam.userId],
		references: [usersInIam.id]
	}),
}));

export const agentsInAgentRelations = relations(agentsInAgent, ({one, many}) => ({
	usersInIam: one(usersInIam, {
		fields: [agentsInAgent.createdByUserId],
		references: [usersInIam.id]
	}),
	versionsInAgent: one(versionsInAgent, {
		fields: [agentsInAgent.currentVersionId],
		references: [versionsInAgent.id],
		relationName: "agentsInAgent_currentVersionId_versionsInAgent_id"
	}),
	listingsInMarket: one(listingsInMarket, {
		fields: [agentsInAgent.sourceListingId],
		references: [listingsInMarket.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [agentsInAgent.organizationId],
		references: [workspacesInIam.id]
	}),
	versionsInAgents: many(versionsInAgent, {
		relationName: "versionsInAgent_agentId_agentsInAgent_id"
	}),
	triggersInAgents: many(triggersInAgent),
	approvalsInAgents: many(approvalsInAgent),
	memoriesInAgents: many(memoriesInAgent),
	conversationsInAgents: many(conversationsInAgent),
}));

export const versionsInAgentRelations = relations(versionsInAgent, ({one, many}) => ({
	agentsInAgents: many(agentsInAgent, {
		relationName: "agentsInAgent_currentVersionId_versionsInAgent_id"
	}),
	agentsInAgent: one(agentsInAgent, {
		fields: [versionsInAgent.agentId],
		references: [agentsInAgent.id],
		relationName: "versionsInAgent_agentId_agentsInAgent_id"
	}),
	usersInIam: one(usersInIam, {
		fields: [versionsInAgent.createdByUserId],
		references: [usersInIam.id]
	}),
	languagesInRef: one(languagesInRef, {
		fields: [versionsInAgent.language],
		references: [languagesInRef.code]
	}),
	modelsInAi: one(modelsInAi, {
		fields: [versionsInAgent.modelOverrideId],
		references: [modelsInAi.id]
	}),
	routingProfilesInAi: one(routingProfilesInAi, {
		fields: [versionsInAgent.routingProfileId],
		references: [routingProfilesInAi.id]
	}),
	toolGrantsInAgents: many(toolGrantsInAgent),
	capabilityGrantsInAgents: many(capabilityGrantsInAgent),
}));

export const toolGrantsInAgentRelations = relations(toolGrantsInAgent, ({one}) => ({
	versionsInAgent: one(versionsInAgent, {
		fields: [toolGrantsInAgent.agentVersionId],
		references: [versionsInAgent.id]
	}),
	serversInMcp: one(serversInMcp, {
		fields: [toolGrantsInAgent.organizationId],
		references: [serversInMcp.id]
	}),
	serverVersionsInMcp: one(serverVersionsInMcp, {
		fields: [toolGrantsInAgent.organizationId],
		references: [serverVersionsInMcp.id]
	}),
	toolsInMcp: one(toolsInMcp, {
		fields: [toolGrantsInAgent.organizationId],
		references: [toolsInMcp.id]
	}),
}));

export const triggersInAgentRelations = relations(triggersInAgent, ({one}) => ({
	agentsInAgent: one(agentsInAgent, {
		fields: [triggersInAgent.agentId],
		references: [agentsInAgent.id]
	}),
	environmentsInIam: one(environmentsInIam, {
		fields: [triggersInAgent.organizationId],
		references: [environmentsInIam.id]
	}),
	webhookEndpointsInDev: one(webhookEndpointsInDev, {
		fields: [triggersInAgent.organizationId],
		references: [webhookEndpointsInDev.id]
	}),
}));

export const webhookEndpointsInDevRelations = relations(webhookEndpointsInDev, ({one, many}) => ({
	triggersInAgents: many(triggersInAgent),
	connectorsInMcp: one(connectorsInMcp, {
		fields: [webhookEndpointsInDev.organizationId],
		references: [connectorsInMcp.id]
	}),
	environmentsInIam: one(environmentsInIam, {
		fields: [webhookEndpointsInDev.organizationId],
		references: [environmentsInIam.id]
	}),
	secretsInIam: one(secretsInIam, {
		fields: [webhookEndpointsInDev.organizationId],
		references: [secretsInIam.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [webhookEndpointsInDev.organizationId],
		references: [workspacesInIam.id]
	}),
}));

export const approvalsInAgentRelations = relations(approvalsInAgent, ({one}) => ({
	agentsInAgent: one(agentsInAgent, {
		fields: [approvalsInAgent.organizationId],
		references: [agentsInAgent.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [approvalsInAgent.decidedByUserId],
		references: [usersInIam.id]
	}),
	serversInMcp: one(serversInMcp, {
		fields: [approvalsInAgent.organizationId],
		references: [serversInMcp.id]
	}),
	toolsInMcp: one(toolsInMcp, {
		fields: [approvalsInAgent.organizationId],
		references: [toolsInMcp.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [approvalsInAgent.organizationId],
		references: [workspacesInIam.id]
	}),
}));

export const memoriesInAgentRelations = relations(memoriesInAgent, ({one}) => ({
	agentsInAgent: one(agentsInAgent, {
		fields: [memoriesInAgent.organizationId],
		references: [agentsInAgent.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [memoriesInAgent.organizationId],
		references: [workspacesInIam.id]
	}),
}));

export const conversationsInAgentRelations = relations(conversationsInAgent, ({one, many}) => ({
	agentsInAgent: one(agentsInAgent, {
		fields: [conversationsInAgent.organizationId],
		references: [agentsInAgent.id]
	}),
	endUsersInDev: one(endUsersInDev, {
		fields: [conversationsInAgent.endUserId],
		references: [endUsersInDev.id]
	}),
	environmentsInIam: one(environmentsInIam, {
		fields: [conversationsInAgent.organizationId],
		references: [environmentsInIam.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [conversationsInAgent.userId],
		references: [usersInIam.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [conversationsInAgent.organizationId],
		references: [workspacesInIam.id]
	}),
	messagesInAgents: many(messagesInAgent),
}));

export const endUsersInDevRelations = relations(endUsersInDev, ({one, many}) => ({
	conversationsInAgents: many(conversationsInAgent),
	workspacesInIam: one(workspacesInIam, {
		fields: [endUsersInDev.organizationId],
		references: [workspacesInIam.id]
	}),
}));

export const messagesInAgentRelations = relations(messagesInAgent, ({one}) => ({
	usersInIam: one(usersInIam, {
		fields: [messagesInAgent.authorUserId],
		references: [usersInIam.id]
	}),
	conversationsInAgent: one(conversationsInAgent, {
		fields: [messagesInAgent.conversationId],
		references: [conversationsInAgent.id]
	}),
}));

export const apiKeysInDevRelations = relations(apiKeysInDev, ({one, many}) => ({
	usersInIam: one(usersInIam, {
		fields: [apiKeysInDev.createdByUserId],
		references: [usersInIam.id]
	}),
	environmentsInIam: one(environmentsInIam, {
		fields: [apiKeysInDev.organizationId],
		references: [environmentsInIam.id]
	}),
	projectsInIam: one(projectsInIam, {
		fields: [apiKeysInDev.organizationId],
		references: [projectsInIam.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [apiKeysInDev.organizationId],
		references: [workspacesInIam.id]
	}),
	idempotencyKeysInDevs: many(idempotencyKeysInDev),
}));

export const webhookSubscriptionsInDevRelations = relations(webhookSubscriptionsInDev, ({one}) => ({
	usersInIam: one(usersInIam, {
		fields: [webhookSubscriptionsInDev.createdByUserId],
		references: [usersInIam.id]
	}),
	environmentsInIam: one(environmentsInIam, {
		fields: [webhookSubscriptionsInDev.organizationId],
		references: [environmentsInIam.id]
	}),
	secretsInIam: one(secretsInIam, {
		fields: [webhookSubscriptionsInDev.organizationId],
		references: [secretsInIam.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [webhookSubscriptionsInDev.organizationId],
		references: [workspacesInIam.id]
	}),
}));

export const idempotencyKeysInDevRelations = relations(idempotencyKeysInDev, ({one}) => ({
	apiKeysInDev: one(apiKeysInDev, {
		fields: [idempotencyKeysInDev.organizationId],
		references: [apiKeysInDev.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [idempotencyKeysInDev.organizationId],
		references: [organizationsInIam.id]
	}),
}));

export const deviceAuthorizationsInDevRelations = relations(deviceAuthorizationsInDev, ({one}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [deviceAuthorizationsInDev.organizationId],
		references: [organizationsInIam.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [deviceAuthorizationsInDev.userId],
		references: [usersInIam.id]
	}),
}));

export const listingVersionsInMarketRelations = relations(listingVersionsInMarket, ({one, many}) => ({
	listingsInMarkets: many(listingsInMarket, {
		relationName: "listingsInMarket_currentVersionId_listingVersionsInMarket_id"
	}),
	installationsInMarkets: many(installationsInMarket),
	listingsInMarket: one(listingsInMarket, {
		fields: [listingVersionsInMarket.listingId],
		references: [listingsInMarket.id],
		relationName: "listingVersionsInMarket_listingId_listingsInMarket_id"
	}),
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [listingVersionsInMarket.reviewedByStaffId],
		references: [staffUsersInPlatform.id]
	}),
}));

export const entitlementsInMarketRelations = relations(entitlementsInMarket, ({one, many}) => ({
	invoiceLinesInBilling: one(invoiceLinesInBilling, {
		fields: [entitlementsInMarket.invoiceLineId],
		references: [invoiceLinesInBilling.id]
	}),
	listingsInMarket: one(listingsInMarket, {
		fields: [entitlementsInMarket.listingId],
		references: [listingsInMarket.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [entitlementsInMarket.organizationId],
		references: [organizationsInIam.id]
	}),
	installationsInMarkets: many(installationsInMarket),
}));

export const installationsInMarketRelations = relations(installationsInMarket, ({one}) => ({
	entitlementsInMarket: one(entitlementsInMarket, {
		fields: [installationsInMarket.entitlementId],
		references: [entitlementsInMarket.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [installationsInMarket.installedByUserId],
		references: [usersInIam.id]
	}),
	listingsInMarket: one(listingsInMarket, {
		fields: [installationsInMarket.listingId],
		references: [listingsInMarket.id]
	}),
	listingVersionsInMarket: one(listingVersionsInMarket, {
		fields: [installationsInMarket.listingVersionId],
		references: [listingVersionsInMarket.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [installationsInMarket.organizationId],
		references: [workspacesInIam.id]
	}),
}));

export const reviewsInMarketRelations = relations(reviewsInMarket, ({one}) => ({
	listingsInMarket: one(listingsInMarket, {
		fields: [reviewsInMarket.listingId],
		references: [listingsInMarket.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [reviewsInMarket.organizationId],
		references: [organizationsInIam.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [reviewsInMarket.userId],
		references: [usersInIam.id]
	}),
}));

export const legalAcceptancesInComplianceRelations = relations(legalAcceptancesInCompliance, ({one}) => ({
	legalDocumentsInCompliance: one(legalDocumentsInCompliance, {
		fields: [legalAcceptancesInCompliance.documentId],
		references: [legalDocumentsInCompliance.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [legalAcceptancesInCompliance.organizationId],
		references: [organizationsInIam.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [legalAcceptancesInCompliance.userId],
		references: [usersInIam.id]
	}),
}));

export const dataSubjectRequestsInComplianceRelations = relations(dataSubjectRequestsInCompliance, ({one}) => ({
	filesInStorage: one(filesInStorage, {
		fields: [dataSubjectRequestsInCompliance.exportFileId],
		references: [filesInStorage.id]
	}),
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [dataSubjectRequestsInCompliance.handledByStaffId],
		references: [staffUsersInPlatform.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [dataSubjectRequestsInCompliance.organizationId],
		references: [organizationsInIam.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [dataSubjectRequestsInCompliance.userId],
		references: [usersInIam.id]
	}),
}));

export const guardrailProfilesInAiRelations = relations(guardrailProfilesInAi, ({one, many}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [guardrailProfilesInAi.organizationId],
		references: [organizationsInIam.id]
	}),
	guardrailRulesInAis: many(guardrailRulesInAi),
	guardrailBindingsInAis: many(guardrailBindingsInAi),
}));

export const guardrailRulesInAiRelations = relations(guardrailRulesInAi, ({one}) => ({
	guardrailDetectorsInAi: one(guardrailDetectorsInAi, {
		fields: [guardrailRulesInAi.detectorId],
		references: [guardrailDetectorsInAi.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [guardrailRulesInAi.organizationId],
		references: [organizationsInIam.id]
	}),
	guardrailProfilesInAi: one(guardrailProfilesInAi, {
		fields: [guardrailRulesInAi.profileId],
		references: [guardrailProfilesInAi.id]
	}),
}));

export const guardrailBindingsInAiRelations = relations(guardrailBindingsInAi, ({one}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [guardrailBindingsInAi.organizationId],
		references: [organizationsInIam.id]
	}),
	guardrailProfilesInAi: one(guardrailProfilesInAi, {
		fields: [guardrailBindingsInAi.profileId],
		references: [guardrailProfilesInAi.id]
	}),
}));

export const listingPricesInMarketRelations = relations(listingPricesInMarket, ({one}) => ({
	currenciesInRef: one(currenciesInRef, {
		fields: [listingPricesInMarket.currency],
		references: [currenciesInRef.code]
	}),
	listingsInMarket: one(listingsInMarket, {
		fields: [listingPricesInMarket.listingId],
		references: [listingsInMarket.id]
	}),
}));

export const userPreferencesInUxRelations = relations(userPreferencesInUx, ({one}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [userPreferencesInUx.defaultOrgId],
		references: [organizationsInIam.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [userPreferencesInUx.defaultWorkspaceId],
		references: [workspacesInIam.id]
	}),
	currenciesInRef: one(currenciesInRef, {
		fields: [userPreferencesInUx.displayCurrency],
		references: [currenciesInRef.code]
	}),
	usersInIam: one(usersInIam, {
		fields: [userPreferencesInUx.userId],
		references: [usersInIam.id]
	}),
}));

export const uiStatesInUxRelations = relations(uiStatesInUx, ({one}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [uiStatesInUx.organizationId],
		references: [organizationsInIam.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [uiStatesInUx.userId],
		references: [usersInIam.id]
	}),
}));

export const onboardingProgressInUxRelations = relations(onboardingProgressInUx, ({one}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [onboardingProgressInUx.organizationId],
		references: [organizationsInIam.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [onboardingProgressInUx.userId],
		references: [usersInIam.id]
	}),
}));

export const draftsInUxRelations = relations(draftsInUx, ({one}) => ({
	usersInIam: one(usersInIam, {
		fields: [draftsInUx.userId],
		references: [usersInIam.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [draftsInUx.organizationId],
		references: [workspacesInIam.id]
	}),
}));

export const savedViewsInUxRelations = relations(savedViewsInUx, ({one}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [savedViewsInUx.organizationId],
		references: [organizationsInIam.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [savedViewsInUx.userId],
		references: [usersInIam.id]
	}),
}));

export const dashboardsInUxRelations = relations(dashboardsInUx, ({one}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [dashboardsInUx.organizationId],
		references: [organizationsInIam.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [dashboardsInUx.ownerUserId],
		references: [usersInIam.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [dashboardsInUx.organizationId],
		references: [workspacesInIam.id]
	}),
}));

export const notificationsInNotifRelations = relations(notificationsInNotif, ({one, many}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [notificationsInNotif.organizationId],
		references: [organizationsInIam.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [notificationsInNotif.userId],
		references: [usersInIam.id]
	}),
	deliveriesInNotifs: many(deliveriesInNotif),
}));

export const preferencesInNotifRelations = relations(preferencesInNotif, ({one}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [preferencesInNotif.organizationId],
		references: [organizationsInIam.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [preferencesInNotif.userId],
		references: [usersInIam.id]
	}),
}));

export const deliveriesInNotifRelations = relations(deliveriesInNotif, ({one}) => ({
	languagesInRef: one(languagesInRef, {
		fields: [deliveriesInNotif.locale],
		references: [languagesInRef.code]
	}),
	notificationsInNotif: one(notificationsInNotif, {
		fields: [deliveriesInNotif.notificationId],
		references: [notificationsInNotif.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [deliveriesInNotif.organizationId],
		references: [organizationsInIam.id]
	}),
}));

export const supportMessagesInPlatformRelations = relations(supportMessagesInPlatform, ({one}) => ({
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [supportMessagesInPlatform.staffUserId],
		references: [staffUsersInPlatform.id]
	}),
	supportTicketsInPlatform: one(supportTicketsInPlatform, {
		fields: [supportMessagesInPlatform.ticketId],
		references: [supportTicketsInPlatform.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [supportMessagesInPlatform.userId],
		references: [usersInIam.id]
	}),
}));

export const abuseSignalsInPlatformRelations = relations(abuseSignalsInPlatform, ({one}) => ({
	organizationsInIam: one(organizationsInIam, {
		fields: [abuseSignalsInPlatform.organizationId],
		references: [organizationsInIam.id]
	}),
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [abuseSignalsInPlatform.reviewedByStaffId],
		references: [staffUsersInPlatform.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [abuseSignalsInPlatform.userId],
		references: [usersInIam.id]
	}),
}));

export const settingsInPlatformRelations = relations(settingsInPlatform, ({one}) => ({
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [settingsInPlatform.updatedByStaffId],
		references: [staffUsersInPlatform.id]
	}),
}));

export const staffRolePermissionsInPlatformRelations = relations(staffRolePermissionsInPlatform, ({one}) => ({
	staffPermissionsInPlatform: one(staffPermissionsInPlatform, {
		fields: [staffRolePermissionsInPlatform.permissionId],
		references: [staffPermissionsInPlatform.id]
	}),
	staffRolesInPlatform: one(staffRolesInPlatform, {
		fields: [staffRolePermissionsInPlatform.roleId],
		references: [staffRolesInPlatform.id]
	}),
}));

export const staffPermissionsInPlatformRelations = relations(staffPermissionsInPlatform, ({many}) => ({
	staffRolePermissionsInPlatforms: many(staffRolePermissionsInPlatform),
}));

export const staffRolesInPlatformRelations = relations(staffRolesInPlatform, ({many}) => ({
	staffRolePermissionsInPlatforms: many(staffRolePermissionsInPlatform),
	staffUserRolesInPlatforms: many(staffUserRolesInPlatform),
}));

export const rolePermissionsInIamRelations = relations(rolePermissionsInIam, ({one}) => ({
	permissionsInIam: one(permissionsInIam, {
		fields: [rolePermissionsInIam.permissionId],
		references: [permissionsInIam.id]
	}),
	rolesInIam: one(rolesInIam, {
		fields: [rolePermissionsInIam.roleId],
		references: [rolesInIam.id]
	}),
}));

export const permissionsInIamRelations = relations(permissionsInIam, ({many}) => ({
	rolePermissionsInIam: many(rolePermissionsInIam),
}));

export const planFeaturesInBillingRelations = relations(planFeaturesInBilling, ({one}) => ({
	featuresInBilling: one(featuresInBilling, {
		fields: [planFeaturesInBilling.featureId],
		references: [featuresInBilling.id]
	}),
	plansInBilling: one(plansInBilling, {
		fields: [planFeaturesInBilling.planId],
		references: [plansInBilling.id]
	}),
}));

export const featuresInBillingRelations = relations(featuresInBilling, ({many}) => ({
	planFeaturesInBillings: many(planFeaturesInBilling),
	organizationFeatureOverridesInBillings: many(organizationFeatureOverridesInBilling),
}));

export const accessTokenToolsInMcpRelations = relations(accessTokenToolsInMcp, ({one}) => ({
	accessTokensInMcp: one(accessTokensInMcp, {
		fields: [accessTokenToolsInMcp.tokenId],
		references: [accessTokensInMcp.id]
	}),
	toolsInMcp: one(toolsInMcp, {
		fields: [accessTokenToolsInMcp.toolId],
		references: [toolsInMcp.id]
	}),
}));

export const bundleItemsInMarketRelations = relations(bundleItemsInMarket, ({one}) => ({
	listingsInMarket_bundleListingId: one(listingsInMarket, {
		fields: [bundleItemsInMarket.bundleListingId],
		references: [listingsInMarket.id],
		relationName: "bundleItemsInMarket_bundleListingId_listingsInMarket_id"
	}),
	listingsInMarket_itemListingId: one(listingsInMarket, {
		fields: [bundleItemsInMarket.itemListingId],
		references: [listingsInMarket.id],
		relationName: "bundleItemsInMarket_itemListingId_listingsInMarket_id"
	}),
}));

export const announcementDismissalsInPlatformRelations = relations(announcementDismissalsInPlatform, ({one}) => ({
	announcementsInPlatform: one(announcementsInPlatform, {
		fields: [announcementDismissalsInPlatform.announcementId],
		references: [announcementsInPlatform.id]
	}),
	usersInIam: one(usersInIam, {
		fields: [announcementDismissalsInPlatform.userId],
		references: [usersInIam.id]
	}),
}));

export const staffUserRolesInPlatformRelations = relations(staffUserRolesInPlatform, ({one}) => ({
	staffUsersInPlatform_grantedBy: one(staffUsersInPlatform, {
		fields: [staffUserRolesInPlatform.grantedBy],
		references: [staffUsersInPlatform.id],
		relationName: "staffUserRolesInPlatform_grantedBy_staffUsersInPlatform_id"
	}),
	staffRolesInPlatform: one(staffRolesInPlatform, {
		fields: [staffUserRolesInPlatform.roleId],
		references: [staffRolesInPlatform.id]
	}),
	staffUsersInPlatform_staffUserId: one(staffUsersInPlatform, {
		fields: [staffUserRolesInPlatform.staffUserId],
		references: [staffUsersInPlatform.id],
		relationName: "staffUserRolesInPlatform_staffUserId_staffUsersInPlatform_id"
	}),
}));

export const routingRuleTargetsInAiRelations = relations(routingRuleTargetsInAi, ({one}) => ({
	modelsInAi: one(modelsInAi, {
		fields: [routingRuleTargetsInAi.modelId],
		references: [modelsInAi.id]
	}),
	routingRulesInAi: one(routingRulesInAi, {
		fields: [routingRuleTargetsInAi.ruleId],
		references: [routingRulesInAi.id]
	}),
}));

export const teamMembersInIamRelations = relations(teamMembersInIam, ({one}) => ({
	membershipsInIam: one(membershipsInIam, {
		fields: [teamMembersInIam.membershipId],
		references: [membershipsInIam.id]
	}),
	teamsInIam: one(teamsInIam, {
		fields: [teamMembersInIam.teamId],
		references: [teamsInIam.id]
	}),
}));

export const capabilityReleaseVariantsInAiRelations = relations(capabilityReleaseVariantsInAi, ({one}) => ({
	capabilityReleasesInAi: one(capabilityReleasesInAi, {
		fields: [capabilityReleaseVariantsInAi.releaseId],
		references: [capabilityReleasesInAi.id]
	}),
	capabilityVersionsInAi: one(capabilityVersionsInAi, {
		fields: [capabilityReleaseVariantsInAi.versionId],
		references: [capabilityVersionsInAi.id]
	}),
}));

export const capabilityGrantsInAgentRelations = relations(capabilityGrantsInAgent, ({one}) => ({
	versionsInAgent: one(versionsInAgent, {
		fields: [capabilityGrantsInAgent.agentVersionId],
		references: [versionsInAgent.id]
	}),
	capabilitiesInAi: one(capabilitiesInAi, {
		fields: [capabilityGrantsInAgent.organizationId],
		references: [capabilitiesInAi.id]
	}),
}));

export const workspaceMembersInIamRelations = relations(workspaceMembersInIam, ({one}) => ({
	membershipsInIam: one(membershipsInIam, {
		fields: [workspaceMembersInIam.membershipId],
		references: [membershipsInIam.id]
	}),
	rolesInIam: one(rolesInIam, {
		fields: [workspaceMembersInIam.roleId],
		references: [rolesInIam.id]
	}),
	workspacesInIam: one(workspacesInIam, {
		fields: [workspaceMembersInIam.workspaceId],
		references: [workspacesInIam.id]
	}),
}));

export const featureFlagOverridesInPlatformRelations = relations(featureFlagOverridesInPlatform, ({one}) => ({
	featureFlagsInPlatform: one(featureFlagsInPlatform, {
		fields: [featureFlagOverridesInPlatform.flagId],
		references: [featureFlagsInPlatform.id]
	}),
}));

export const translationsInPlatformRelations = relations(translationsInPlatform, ({one}) => ({
	languagesInRef: one(languagesInRef, {
		fields: [translationsInPlatform.locale],
		references: [languagesInRef.code]
	}),
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [translationsInPlatform.updatedByStaffId],
		references: [staffUsersInPlatform.id]
	}),
}));

export const organizationFeatureOverridesInBillingRelations = relations(organizationFeatureOverridesInBilling, ({one}) => ({
	staffUsersInPlatform: one(staffUsersInPlatform, {
		fields: [organizationFeatureOverridesInBilling.grantedByStaffId],
		references: [staffUsersInPlatform.id]
	}),
	featuresInBilling: one(featuresInBilling, {
		fields: [organizationFeatureOverridesInBilling.featureId],
		references: [featuresInBilling.id]
	}),
	organizationsInIam: one(organizationsInIam, {
		fields: [organizationFeatureOverridesInBilling.organizationId],
		references: [organizationsInIam.id]
	}),
}));

export const evalResultsInAiRelations = relations(evalResultsInAi, ({one}) => ({
	evalCasesInAi: one(evalCasesInAi, {
		fields: [evalResultsInAi.caseId],
		references: [evalCasesInAi.id]
	}),
	evalRunsInAi: one(evalRunsInAi, {
		fields: [evalResultsInAi.evalRunId],
		references: [evalRunsInAi.id]
	}),
}));

export const creditLedgerDefaultInBillingRelations = relations(creditLedgerDefaultInBilling, ({one}) => ({
	creditWalletsInBilling: one(creditWalletsInBilling, {
		fields: [creditLedgerDefaultInBilling.organizationId],
		references: [creditWalletsInBilling.id]
	}),
}));

export const creditLedgerP202609InBillingRelations = relations(creditLedgerP202609InBilling, ({one}) => ({
	creditWalletsInBilling: one(creditWalletsInBilling, {
		fields: [creditLedgerP202609InBilling.organizationId],
		references: [creditWalletsInBilling.id]
	}),
}));

export const creditLedgerP202610InBillingRelations = relations(creditLedgerP202610InBilling, ({one}) => ({
	creditWalletsInBilling: one(creditWalletsInBilling, {
		fields: [creditLedgerP202610InBilling.organizationId],
		references: [creditWalletsInBilling.id]
	}),
}));

export const creditLedgerP202611InBillingRelations = relations(creditLedgerP202611InBilling, ({one}) => ({
	creditWalletsInBilling: one(creditWalletsInBilling, {
		fields: [creditLedgerP202611InBilling.organizationId],
		references: [creditWalletsInBilling.id]
	}),
}));

export const creditLedgerP202612InBillingRelations = relations(creditLedgerP202612InBilling, ({one}) => ({
	creditWalletsInBilling: one(creditWalletsInBilling, {
		fields: [creditLedgerP202612InBilling.organizationId],
		references: [creditWalletsInBilling.id]
	}),
}));