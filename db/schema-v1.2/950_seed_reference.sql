-- =============================================================================
-- 950_seed_reference.sql — Données de référence initiales (idempotent)
-- Encode les décisions produit : grille des plans (validée), prix provisoires,
-- compteurs infra, profils de routage, rôles & permissions, codes d'erreur,
-- paramètres (nom provisoire), feature flags (activation échelonnée).
-- Montants en unités mineures ; crédits en micro-crédits (1 cr = 1 000 000).
-- =============================================================================

-- ------------------------------------------------------------- référentiels
INSERT INTO ref.currencies (code, name, symbol, minor_units) VALUES
  ('XAF', '{"fr":"Franc CFA (CEMAC)","en":"Central African CFA franc"}', 'FCFA', 0),
  ('XOF', '{"fr":"Franc CFA (UEMOA)","en":"West African CFA franc"}', 'FCFA', 0),
  ('EUR', '{"fr":"Euro","en":"Euro"}', '€', 2),
  ('USD', '{"fr":"Dollar américain","en":"US dollar"}', '$', 2)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ref.languages (code, name, is_default) VALUES
  ('fr', '{"fr":"Français","en":"French"}', true),
  ('en', '{"fr":"Anglais","en":"English"}', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ref.data_regions (code, name, hosting_provider, location, country_code, is_default) VALUES
  ('eu-fr', '{"fr":"Europe (France)","en":"Europe (France)"}', 'ovh', 'France (VPS-4)', 'FR', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ref.countries (code, name, default_currency, default_language, default_data_region_id, phone_prefix)
SELECT v.code, v.name::jsonb, v.cur, v.lang, (SELECT id FROM ref.data_regions WHERE code = 'eu-fr'), v.prefix
FROM (VALUES
  ('CM', '{"fr":"Cameroun","en":"Cameroon"}', 'XAF', 'fr', '+237'),
  ('GA', '{"fr":"Gabon","en":"Gabon"}', 'XAF', 'fr', '+241'),
  ('CG', '{"fr":"Congo","en":"Republic of the Congo"}', 'XAF', 'fr', '+242'),
  ('TD', '{"fr":"Tchad","en":"Chad"}', 'XAF', 'fr', '+235'),
  ('CF', '{"fr":"Centrafrique","en":"Central African Republic"}', 'XAF', 'fr', '+236'),
  ('GQ', '{"fr":"Guinée équatoriale","en":"Equatorial Guinea"}', 'XAF', 'fr', '+240'),
  ('CI', '{"fr":"Côte d''Ivoire","en":"Côte d''Ivoire"}', 'XOF', 'fr', '+225'),
  ('SN', '{"fr":"Sénégal","en":"Senegal"}', 'XOF', 'fr', '+221'),
  ('BJ', '{"fr":"Bénin","en":"Benin"}', 'XOF', 'fr', '+229'),
  ('TG', '{"fr":"Togo","en":"Togo"}', 'XOF', 'fr', '+228'),
  ('BF', '{"fr":"Burkina Faso","en":"Burkina Faso"}', 'XOF', 'fr', '+226'),
  ('ML', '{"fr":"Mali","en":"Mali"}', 'XOF', 'fr', '+223'),
  ('FR', '{"fr":"France","en":"France"}', 'EUR', 'fr', '+33'),
  ('BE', '{"fr":"Belgique","en":"Belgium"}', 'EUR', 'fr', '+32'),
  ('US', '{"fr":"États-Unis","en":"United States"}', 'USD', 'en', '+1')
) AS v(code, name, cur, lang, prefix)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------ permissions & rôles
INSERT INTO iam.permissions (key, category, description)
SELECT k, split_part(k, '.', 1), jsonb_build_object('fr', d, 'en', k)
FROM (VALUES
  ('org.manage','Gérer l''organisation'), ('org.delete','Supprimer l''organisation'),
  ('members.invite','Inviter des membres'), ('members.manage','Gérer les membres et rôles'),
  ('billing.view','Voir la facturation'), ('billing.manage','Gérer abonnement, paiements, recharges'),
  ('budgets.manage','Gérer les budgets'), ('workspaces.create','Créer des workspaces'),
  ('workspaces.manage','Gérer les workspaces'), ('connectors.create','Créer des connecteurs'),
  ('connectors.manage','Modifier les connecteurs et identifiants'), ('mcp.create','Créer des serveurs MCP'),
  ('mcp.publish','Publier une version MCP'), ('mcp.tokens.manage','Gérer les jetons MCP'),
  ('agents.create','Créer des agents'), ('agents.manage','Modifier les agents'),
  ('agents.run','Déclencher des agents'), ('approvals.decide','Approuver / refuser les actions'),
  ('capabilities.manage','Gérer les capacités et prompts'), ('capabilities.release','Mettre en production une capacité'),
  ('apikeys.manage','Gérer les clés API'), ('byok.manage','Gérer les clés BYOK'),
  ('webhooks.manage','Gérer les webhooks'), ('logs.view','Voir runs et journaux'),
  ('audit.view','Voir le journal d''audit'), ('audit.export','Exporter le journal d''audit'),
  ('marketplace.install','Installer depuis la marketplace'), ('marketplace.publish','Publier sur la marketplace'),
  ('chat.use','Utiliser le chat'), ('settings.view','Voir les paramètres')
) AS p(k, d)
ON CONFLICT (key) DO NOTHING;

INSERT INTO iam.roles (key, name, description, is_system) VALUES
  ('owner',     '{"fr":"Propriétaire","en":"Owner"}',   '{"fr":"Accès total, facturation, suppression","en":"Full access"}', true),
  ('admin',     '{"fr":"Administrateur","en":"Admin"}', '{"fr":"Tout sauf facturation et suppression","en":"All but billing and deletion"}', true),
  ('developer', '{"fr":"Développeur","en":"Developer"}','{"fr":"Crée connecteurs, MCP, agents, capacités","en":"Builds"}', true),
  ('operator',  '{"fr":"Opérateur","en":"Operator"}',   '{"fr":"Déclenche, approuve, consulte","en":"Runs and approves"}', true),
  ('viewer',    '{"fr":"Lecteur","en":"Viewer"}',       '{"fr":"Lecture seule","en":"Read only"}', true)
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO iam.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM iam.roles r JOIN iam.permissions p ON (
     r.key = 'owner'
  OR (r.key = 'admin'     AND p.key NOT IN ('org.delete','billing.manage'))
  OR (r.key = 'developer' AND p.key IN ('workspaces.manage','connectors.create','connectors.manage','mcp.create','mcp.publish',
        'mcp.tokens.manage','agents.create','agents.manage','agents.run','capabilities.manage','capabilities.release',
        'apikeys.manage','byok.manage','webhooks.manage','logs.view','marketplace.install','chat.use','settings.view','billing.view'))
  OR (r.key = 'operator'  AND p.key IN ('agents.run','approvals.decide','logs.view','chat.use','settings.view'))
  OR (r.key = 'viewer'    AND p.key IN ('logs.view','settings.view','billing.view'))
) WHERE r.is_system
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------ plans
INSERT INTO billing.plans (key, name, tier, is_public, is_custom, sort_order) VALUES
  ('free',       '{"fr":"Gratuit","en":"Free"}',          0, true,  false, 10),
  ('starter',    '{"fr":"Starter","en":"Starter"}',       1, true,  false, 20),
  ('pro',        '{"fr":"Pro","en":"Pro"}',               2, true,  false, 30),
  ('business',   '{"fr":"Business","en":"Business"}',     3, true,  false, 40),
  ('enterprise', '{"fr":"Entreprise","en":"Enterprise"}', 4, true,  true,  50)
ON CONFLICT (key) DO NOTHING;

INSERT INTO billing.plans (key, name, tier, is_byok_variant, base_plan_id, is_public, sort_order)
SELECT b.key || '_byok', jsonb_build_object('fr', (b.name->>'fr') || ' BYOK', 'en', (b.name->>'en') || ' BYOK'),
       b.tier, true, b.id, true, b.sort_order + 1
FROM billing.plans b WHERE b.key IN ('starter','pro','business')
ON CONFLICT (key) DO NOTHING;

-- Prix mensuels provisoires (XAF = XOF : même parité fixe avec l'euro)
INSERT INTO billing.plan_prices (plan_id, currency, billing_interval, amount_minor, included_llm_credits_micro,
                                 included_infra_credits_micro, llm_coefficient, effective_during)
SELECT p.id, c.cur, 'month',
       CASE c.cur WHEN 'EUR' THEN v.eur ELSE v.xaf END,
       v.llm_cr::bigint * 1000000, v.infra_cr::bigint * 1000000, v.coef, tstzrange('2026-10-01', NULL)
FROM (VALUES
  ('free',              0,    0,   300,     200, 1.30),
  ('starter',        4900,  749,  2500,    1000, 1.30),
  ('starter_byok',   2900,  449,     0,    2000, 1.00),
  ('pro',           19900, 2999, 12000,    5000, 1.20),
  ('pro_byok',      12900, 1999,     0,   10000, 1.00),
  ('business',      49900, 7599, 30000,   15000, 1.15),
  ('business_byok', 34900, 5299,     0,   25000, 1.00)
) AS v(plan_key, xaf, eur, llm_cr, infra_cr, coef)
JOIN billing.plans p ON p.key = v.plan_key
CROSS JOIN (VALUES ('XAF'), ('XOF'), ('EUR')) AS c(cur)
WHERE NOT EXISTS (SELECT 1 FROM billing.plan_prices pp WHERE pp.plan_id = p.id AND pp.currency = c.cur);

-- ------------------------------------------------ grille des droits par plan
INSERT INTO billing.features (key, category, value_type, unit, name, sort_order)
SELECT k, split_part(k, '.', 1), t, u, jsonb_build_object('fr', n, 'en', k), row_number() OVER ()
FROM (VALUES
  ('workspace.workspaces.max','integer','count','Workspaces'),
  ('workspace.members.max','integer','count','Membres'),
  ('workspace.environments.max','integer','count','Environnements'),
  ('workspace.custom_roles','boolean',NULL,'Rôles personnalisés'),
  ('workspace.teams','boolean',NULL,'Équipes / départements'),
  ('mcp.servers.max','integer','count','Serveurs MCP'),
  ('mcp.tools_per_server.max','integer','count','Outils par serveur'),
  ('mcp.connectors.prebuilt.max','integer','count','Connecteurs prêts à l''emploi'),
  ('mcp.connectors.openapi','boolean',NULL,'OpenAPI et API sans doc'),
  ('mcp.connectors.database','string',NULL,'Base de données'),
  ('mcp.connectors.bridge','boolean',NULL,'Bridge local'),
  ('mcp.byo_mcp','boolean',NULL,'Bring your own MCP'),
  ('mcp.oauth_clients','boolean',NULL,'Connexion Claude / ChatGPT (OAuth)'),
  ('agents.max','integer','count','Agents'),
  ('agents.trigger_types','string_list',NULL,'Types de déclencheurs'),
  ('agents.concurrency.max','integer','count','Exécutions simultanées'),
  ('agents.memory.retention_days','integer','days','Mémoire long terme'),
  ('agents.approvals.delegation','boolean',NULL,'Délégation des approbations'),
  ('agents.approvals.workflows','boolean',NULL,'Circuits d''approbation'),
  ('ai.routing_profiles','string_list',NULL,'Profils de modèles'),
  ('ai.custom_routing_profiles','boolean',NULL,'Profils de routage personnalisés'),
  ('ai.model_override','boolean',NULL,'Choix d''un modèle précis'),
  ('ai.byok','boolean',NULL,'BYOK'),
  ('ai.prompt_studio.versions','boolean',NULL,'Prompt Studio : versions'),
  ('ai.prompt_studio.ab_testing','boolean',NULL,'Prompt Studio : test A/B'),
  ('ai.prompt_studio.evals','boolean',NULL,'Prompt Studio : évaluations'),
  ('ai.optimization','boolean',NULL,'Optimisation et cache'),
  ('dev.sdk','string',NULL,'SDK et CLI'),
  ('dev.outbound_webhooks','boolean',NULL,'Webhooks sortants'),
  ('dev.sandbox','boolean',NULL,'Mode test'),
  ('dev.api_rate_limit_per_min','integer','per_minute','Limite de débit API'),
  ('control.budgets','string',NULL,'Budgets et alertes'),
  ('control.log_retention_days','integer','days','Rétention des logs'),
  ('control.audit_export','boolean',NULL,'Export de l''audit'),
  ('control.sso','string',NULL,'SSO'),
  ('control.custom_domain','boolean',NULL,'Domaine personnalisé'),
  ('control.data_region_choice','boolean',NULL,'Choix de la région de données'),
  ('market.install','string',NULL,'Installation marketplace'),
  ('market.publish','string_list',NULL,'Publication marketplace'),
  ('support.level','string',NULL,'Support')
) AS f(k, t, u, n)
ON CONFLICT (key) DO NOTHING;

-- -1 = illimité. Colonnes : free, starter, pro, business, enterprise
WITH grid(feature_key, v_free, v_starter, v_pro, v_business, v_enterprise) AS (VALUES
  ('workspace.workspaces.max',      '1',  '3',   '-1',  '-1',  '-1'),
  ('workspace.members.max',         '1',  '3',   '10',  '30',  '-1'),
  ('workspace.environments.max',    '1',  '2',   '3',   '5',   '-1'),
  ('workspace.custom_roles',        'false','false','false','false','true'),
  ('workspace.teams',               'false','false','false','true','true'),
  ('mcp.servers.max',               '1',  '5',   '-1',  '-1',  '-1'),
  ('mcp.tools_per_server.max',      '10', '30',  '100', '100', '-1'),
  ('mcp.connectors.prebuilt.max',   '2',  '-1',  '-1',  '-1',  '-1'),
  ('mcp.connectors.openapi',        'false','true','true','true','true'),
  ('mcp.connectors.database',       '"none"','"read_only"','"read_write_controlled"','"read_write_controlled"','"read_write_controlled"'),
  ('mcp.connectors.bridge',         'false','false','true','true','true'),
  ('mcp.byo_mcp',                   'false','false','true','true','true'),
  ('mcp.oauth_clients',             'true','true','true','true','true'),
  ('agents.max',                    '1',  '3',   '-1',  '-1',  '-1'),
  ('agents.trigger_types',          '["chat"]','["chat","manual","schedule"]',
                                    '["chat","manual","schedule","webhook","threshold","event"]',
                                    '["chat","manual","schedule","webhook","threshold","event"]',
                                    '["chat","manual","schedule","webhook","threshold","event"]'),
  ('agents.concurrency.max',        '1',  '2',   '10',  '25',  '-1'),
  ('agents.memory.retention_days',  '0',  '30',  '90',  '180', '-1'),
  ('agents.approvals.delegation',   'false','false','true','true','true'),
  ('agents.approvals.workflows',    'false','false','false','true','true'),
  ('ai.routing_profiles',           '["flash"]','["flash","smart"]','["flash","smart","max"]','["flash","smart","max"]','["flash","smart","max"]'),
  ('ai.custom_routing_profiles',    'false','false','true','true','true'),
  ('ai.model_override',             'false','false','true','true','true'),
  ('ai.byok',                       'false','true','true','true','true'),
  ('ai.prompt_studio.versions',     'false','true','true','true','true'),
  ('ai.prompt_studio.ab_testing',   'false','false','true','true','true'),
  ('ai.prompt_studio.evals',        'false','false','false','true','true'),
  ('ai.optimization',               'false','true','true','true','true'),
  ('dev.sdk',                       '"test_only"','"full"','"full"','"full"','"full"'),
  ('dev.outbound_webhooks',         'false','true','true','true','true'),
  ('dev.sandbox',                   'true','true','true','true','true'),
  ('dev.api_rate_limit_per_min',    '30', '120', '600', '1500','-1'),
  ('control.budgets',               '"alert_only"','"standard"','"per_environment"','"per_team"','"per_team"'),
  ('control.log_retention_days',    '7',  '30',  '90',  '180', '365'),
  ('control.audit_export',          'false','false','true','true','true'),
  ('control.sso',                   '"none"','"none"','"none"','"social"','"saml_oidc"'),
  ('control.custom_domain',         'false','false','true','true','true'),
  ('control.data_region_choice',    'false','false','false','false','true'),
  ('market.install',                '"free_only"','"all"','"all"','"all"','"all_with_private_catalog"'),
  ('market.publish',                '[]','["community"]','["community","verified","premium"]','["community","verified","premium"]','["community","verified","premium"]'),
  ('support.level',                 '"docs"','"email_48h"','"email_24h_chat"','"email_12h_chat"','"dedicated_sla"')
)
INSERT INTO billing.plan_features (plan_id, feature_id, value)
SELECT p.id, f.id, (CASE p.key WHEN 'free' THEN g.v_free WHEN 'starter' THEN g.v_starter WHEN 'pro' THEN g.v_pro
                               WHEN 'business' THEN g.v_business ELSE g.v_enterprise END)::jsonb
FROM grid g JOIN billing.features f ON f.key = g.feature_key
JOIN billing.plans p ON p.key IN ('free','starter','pro','business','enterprise')
ON CONFLICT DO NOTHING;

-- Variantes BYOK = mêmes droits que le plan de base
INSERT INTO billing.plan_features (plan_id, feature_id, value)
SELECT v.id, pf.feature_id, pf.value
FROM billing.plans v JOIN billing.plan_features pf ON pf.plan_id = v.base_plan_id
WHERE v.is_byok_variant
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------- packs de recharge
INSERT INTO billing.credit_packs (key, kind, credits_micro, name, sort_order) VALUES
  ('llm_1k',   'llm',   1000 * 1000000::bigint, '{"fr":"1 000 crédits","en":"1,000 credits"}', 10),
  ('llm_5k',   'llm',   5000 * 1000000::bigint, '{"fr":"5 000 crédits","en":"5,000 credits"}', 20),
  ('llm_20k',  'llm',  20000 * 1000000::bigint, '{"fr":"20 000 crédits","en":"20,000 credits"}', 30),
  ('llm_100k', 'llm', 100000 * 1000000::bigint, '{"fr":"100 000 crédits","en":"100,000 credits"}', 40)
ON CONFLICT (key) DO NOTHING;

INSERT INTO billing.credit_pack_prices (pack_id, currency, amount_minor, effective_during)
SELECT cp.id, c.cur, v.xaf, tstzrange('2026-10-01', NULL)
FROM (VALUES ('llm_1k', 1000), ('llm_5k', 4750), ('llm_20k', 18000), ('llm_100k', 85000)) AS v(k, xaf)
JOIN billing.credit_packs cp ON cp.key = v.k
CROSS JOIN (VALUES ('XAF'), ('XOF')) AS c(cur)
WHERE NOT EXISTS (SELECT 1 FROM billing.credit_pack_prices x WHERE x.pack_id = cp.id AND x.currency = c.cur);

-- ------------------------------------------------------- compteurs infra
INSERT INTO billing.infra_meters (key, unit, name) VALUES
  ('gateway_byok_request', 'request',  '{"fr":"Requête gateway en BYOK","en":"BYOK gateway request"}'),
  ('mcp_tool_call',        'call',     '{"fr":"Appel d''outil MCP","en":"MCP tool call"}'),
  ('agent_run',            'run',      '{"fr":"Exécution d''agent","en":"Agent run"}'),
  ('agent_step_extra',     'step',     '{"fr":"Étape d''agent au-delà de 10","en":"Agent step beyond 10"}'),
  ('trigger_fire',         'fire',     '{"fr":"Déclenchement planifié / webhook","en":"Trigger fire"}'),
  ('memory_gb_month',      'gb_month', '{"fr":"Mémoire long terme (Go/mois)","en":"Long-term memory (GB/month)"}'),
  ('storage_gb_month',     'gb_month', '{"fr":"Stockage de fichiers (Go/mois)","en":"File storage (GB/month)"}'),
  ('bridge_month',         'month',    '{"fr":"Bridge local actif","en":"Active local bridge"}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO billing.infra_meter_rates (meter_id, plan_id, credits_micro_per_unit, effective_during)
SELECT m.id, NULL, v.micro, tstzrange('2026-10-01', NULL)
FROM (VALUES ('gateway_byok_request', 100000::bigint), ('mcp_tool_call', 500000), ('agent_run', 2000000),
             ('agent_step_extra', 200000), ('trigger_fire', 100000), ('memory_gb_month', 50000000),
             ('storage_gb_month', 100000000), ('bridge_month', 500000000)) AS v(k, micro)
JOIN billing.infra_meters m ON m.key = v.k
WHERE NOT EXISTS (SELECT 1 FROM billing.infra_meter_rates r WHERE r.meter_id = m.id AND r.plan_id IS NULL);

-- ------------------------------------------------------ profils de routage
INSERT INTO ai.routing_profiles (key, name, description, strategy, is_system) VALUES
  ('flash', '{"fr":"Flash","en":"Flash"}', '{"fr":"Priorité coût et vitesse","en":"Cost and speed first"}', '{"cost":0.6,"latency":0.3,"quality":0.1}', true),
  ('smart', '{"fr":"Smart","en":"Smart"}', '{"fr":"Équilibre coût / qualité","en":"Balanced"}',          '{"cost":0.4,"latency":0.2,"quality":0.4}', true),
  ('max',   '{"fr":"Max","en":"Max"}',     '{"fr":"Priorité qualité et raisonnement","en":"Quality first"}', '{"cost":0.1,"latency":0.1,"quality":0.8}', true)
ON CONFLICT (organization_id, key) DO NOTHING;

-- ----------------------------------------------------------- codes d'erreur
INSERT INTO platform.error_codes (code, category, http_status, message, is_retryable, refunds_credits, doc_path)
SELECT c, split_part(c, '_', 1), h, jsonb_build_object('fr', fr, 'en', en), rt, rf, '/errors/' || lower(c)
FROM (VALUES
  ('AUTH_TOKEN_INVALID',401,'Jeton d''authentification invalide','Invalid authentication token',false,false),
  ('AUTH_TOKEN_EXPIRED',401,'Jeton expiré','Token expired',false,false),
  ('AUTH_TOKEN_REVOKED',401,'Jeton révoqué','Token revoked',false,false),
  ('AUTH_INSUFFICIENT_PERMISSIONS',403,'Action non autorisée pour ce rôle','Insufficient permissions',false,false),
  ('AUTH_WORKSPACE_SUSPENDED',403,'Workspace suspendu','Workspace suspended',false,false),
  ('AUTH_ORGANIZATION_SUSPENDED',403,'Organisation suspendue','Organization suspended',false,false),
  ('AUTH_MFA_REQUIRED',403,'Double authentification requise','MFA required',false,false),
  ('AUTH_OAUTH_CONSENT_REQUIRED',403,'Consentement requis pour ce client','Consent required for this client',false,false),
  ('BILLING_INSUFFICIENT_CREDITS',402,'Crédits insuffisants','Insufficient credits',false,false),
  ('BILLING_BUDGET_EXCEEDED',402,'Budget épuisé','Budget exceeded',false,false),
  ('BILLING_PLAN_LIMIT_REACHED',402,'Limite du plan atteinte','Plan limit reached',false,false),
  ('BILLING_PAYMENT_FAILED',402,'Échec du paiement','Payment failed',false,false),
  ('BILLING_PAYMENT_PENDING',409,'Paiement en attente de confirmation','Payment pending',true,false),
  ('BILLING_SUBSCRIPTION_EXPIRED',402,'Abonnement expiré','Subscription expired',false,false),
  ('MCP_SERVER_NOT_FOUND',404,'Serveur MCP introuvable','MCP server not found',false,false),
  ('MCP_SERVER_NOT_ACTIVE',409,'Serveur MCP inactif','MCP server not active',false,false),
  ('MCP_TOOL_NOT_FOUND',404,'Outil introuvable','Tool not found',false,false),
  ('MCP_TOOL_DISABLED',409,'Outil désactivé','Tool disabled',false,false),
  ('MCP_TOOL_PERMISSION_DENIED',403,'Outil non autorisé','Tool not permitted',false,false),
  ('MCP_TOOL_INPUT_INVALID',422,'Paramètres non conformes au schéma','Input does not match schema',false,false),
  ('MCP_TOOL_REQUIRES_APPROVAL',202,'Approbation humaine requise','Human approval required',false,false),
  ('MCP_SQL_STATEMENT_REJECTED',422,'Requête SQL refusée par les règles de sécurité','SQL statement rejected',false,false),
  ('MCP_CONNECTOR_UNREACHABLE',502,'Système externe inaccessible','External system unreachable',true,true),
  ('MCP_CONNECTOR_AUTH_FAILED',502,'Authentification refusée par le système externe','External authentication failed',false,false),
  ('MCP_CONNECTOR_TIMEOUT',504,'Délai dépassé vers le système externe','External system timeout',true,true),
  ('MCP_CIRCUIT_BREAKER_OPEN',503,'Outil temporairement indisponible','Tool temporarily unavailable',true,false),
  ('MCP_BRIDGE_OFFLINE',503,'Bridge local hors ligne','Local bridge offline',true,false),
  ('AGENT_NOT_FOUND',404,'Agent introuvable','Agent not found',false,false),
  ('AGENT_NOT_ACTIVE',409,'Agent inactif','Agent not active',false,false),
  ('AGENT_ALREADY_RUNNING',409,'Agent déjà en cours d''exécution','Agent already running',true,false),
  ('AGENT_MAX_ITERATIONS_REACHED',422,'Nombre maximal d''itérations atteint','Max iterations reached',false,false),
  ('AGENT_TIMEOUT',408,'Durée maximale dépassée','Run timeout',false,false),
  ('AGENT_BUDGET_EXCEEDED',402,'Budget de l''agent dépassé','Agent budget exceeded',false,false),
  ('AGENT_TOOL_LOOP_DETECTED',422,'Boucle d''appels d''outils détectée','Tool loop detected',false,false),
  ('AGENT_SELF_REFERENCE_DENIED',403,'Un agent ne peut pas se déclencher lui-même','Self trigger denied',false,false),
  ('AGENT_NESTING_TOO_DEEP',422,'Profondeur d''appels imbriqués dépassée','Nesting too deep',false,false),
  ('AGENT_OUTSIDE_ALLOWED_HOURS',409,'Hors des heures autorisées','Outside allowed hours',false,false),
  ('AGENT_AWAITING_APPROVAL',202,'En attente d''approbation','Awaiting approval',false,false),
  ('LLM_PROVIDER_UNAVAILABLE',503,'Aucun fournisseur disponible','No provider available',true,true),
  ('LLM_PROVIDER_RATE_LIMITED',429,'Limite du fournisseur atteinte','Provider rate limited',true,false),
  ('LLM_CONTEXT_TOO_LONG',422,'Contexte trop long pour le modèle','Context too long',false,false),
  ('LLM_CONTENT_FILTERED',422,'Contenu filtré par le fournisseur','Content filtered',false,false),
  ('LLM_MODEL_NOT_AVAILABLE',404,'Modèle indisponible','Model not available',false,false),
  ('LLM_MODEL_BYOK_ONLY',403,'Modèle accessible uniquement avec votre propre clé','Model available with BYOK only',false,false),
  ('LLM_BYOK_KEY_INVALID',400,'Clé BYOK invalide ou révoquée','Invalid BYOK key',false,false),
  ('MARKET_ITEM_INCOMPATIBLE',409,'Élément incompatible avec votre configuration','Item incompatible',false,false),
  ('MARKET_ENTITLEMENT_REQUIRED',402,'Achat requis pour cet élément','Purchase required',false,false),
  ('WEBHOOK_SIGNATURE_INVALID',401,'Signature du webhook invalide','Invalid webhook signature',false,false),
  ('IDEMPOTENCY_KEY_REUSED',409,'Clé d''idempotence réutilisée avec une autre requête','Idempotency key reused',false,false),
  ('PLATFORM_RATE_LIMIT',429,'Trop de requêtes','Too many requests',true,false),
  ('PLATFORM_MAINTENANCE',503,'Maintenance en cours','Maintenance in progress',true,false),
  ('PLATFORM_INTERNAL_ERROR',500,'Erreur interne','Internal error',true,true),
  ('PLATFORM_FEATURE_NOT_AVAILABLE',403,'Fonction non incluse dans votre plan','Feature not in plan',false,false),
  ('PLATFORM_FEATURE_DISABLED',403,'Fonction pas encore disponible','Feature not yet available',false,false),
  ('PLATFORM_RESOURCE_NOT_FOUND',404,'Ressource introuvable','Resource not found',false,false),
  ('PLATFORM_VALIDATION_ERROR',422,'Données invalides','Validation error',false,false),
  ('PLATFORM_CONFLICT',409,'Conflit (modifié entre-temps ou nom déjà utilisé)','Conflict',false,false)
) AS e(c, h, fr, en, rt, rf)
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------- paramètres plateforme
INSERT INTO platform.settings (key, category, value, is_public, description) VALUES
  ('brand.name',                  'brand',        '"project-cp"', true,  '{"fr":"Nom affiché (provisoire)","en":"Display name (placeholder)"}'),
  ('brand.codename',              'brand',        '"project-cp"', false, '{"fr":"Nom de code interne","en":"Internal codename"}'),
  ('signup.mode',                 'signup',       '"open"',       true,  '{"fr":"open | waitlist | invite_only | closed","en":"Signup mode"}'),
  ('localization.languages',      'localization', '["fr","en"]',  true,  '{"fr":"Langues actives","en":"Active languages"}'),
  ('localization.currencies',     'localization', '["XAF","XOF","EUR"]', true, '{"fr":"Devises actives","en":"Active currencies"}'),
  ('security.session_hours',      'security',     '168',          false, '{"fr":"Durée de session utilisateur (h)","en":"User session (h)"}'),
  ('security.staff_session_hours','security',     '8',            false, '{"fr":"Durée de session admin (h)","en":"Staff session (h)"}'),
  ('free_tier.require_phone_otp', 'free_tier',    'true',         false, '{"fr":"Un compte gratuit par numéro vérifié","en":"One free account per verified phone"}'),
  ('limits.overdraft_credits',    'limits',       '1000',         false, '{"fr":"Découvert technique pour finir un run","en":"Technical overdraft"}'),
  ('limits.run_timeout_max_s',    'limits',       '1800',         false, '{"fr":"Durée max d''un run","en":"Max run duration"}'),
  ('retention.run_payload_days',  'retention',    '30',           false, '{"fr":"Conservation des entrées/sorties de runs","en":"Run payload retention"}'),
  ('payments.reminder_days',      'payments',     '5',            false, '{"fr":"Rappel avant échéance (jours)","en":"Renewal reminder (days)"}'),
  ('ai.fx_source',                'ai',           '"manual"',     false, '{"fr":"Source du taux de change","en":"FX source"}'),
  ('marketplace.revenue_share',   'marketplace',  '0.70',         true,  '{"fr":"Part du créateur","en":"Creator share"}'),
  ('marketplace.payout_threshold_xaf', 'marketplace', '5000',     true,  '{"fr":"Seuil de versement","en":"Payout threshold"}')
ON CONFLICT (key) DO NOTHING;

-- -------------------------------------- feature flags (activation échelonnée)
INSERT INTO platform.feature_flags (key, description, default_value, is_enabled) VALUES
  ('ai.text',                 'Texte, outils, JSON',                    'true',  true),
  ('ai.embeddings',           'Embeddings',                             'true',  true),
  ('ai.vision',               'Lecture d''images et de PDF',            'false', false),
  ('ai.audio_transcription',  'Transcription audio (notes vocales)',    'false', false),
  ('ai.tts',                  'Synthèse vocale',                        'false', false),
  ('ai.image_generation',     'Génération d''images (modération)',      'false', false),
  ('ai.video',                'Vidéo',                                  'false', false),
  ('mcp.bridge',              'Bridge local',                           'false', false),
  ('mcp.byo_mcp',             'Bring your own MCP',                     'false', false),
  ('mcp.tool_routing',        'Tool routing',                           'false', false),
  ('agents.threshold',        'Déclencheurs à seuil',                   'false', false),
  ('marketplace.browse',      'Marketplace : consultation',             'false', false),
  ('marketplace.publish',     'Marketplace : publication',              'false', false),
  ('marketplace.premium',     'Marketplace : vente',                    'false', false),
  ('enterprise.sso',          'SSO',                                    'false', false),
  ('enterprise.data_region',  'Choix de région de données',             'false', false)
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------- équipe interne
INSERT INTO platform.staff_roles (key, name, is_system) VALUES
  ('super_admin', '{"fr":"Super administrateur","en":"Super admin"}', true),
  ('finance',     '{"fr":"Finance","en":"Finance"}',                  true),
  ('support',     '{"fr":"Support","en":"Support"}',                  true),
  ('moderator',   '{"fr":"Modération","en":"Moderator"}',             true),
  ('ops',         '{"fr":"Exploitation","en":"Ops"}',                 true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform.status_components (key, name, sort_order) VALUES
  ('dashboard',   '{"fr":"Tableau de bord","en":"Dashboard"}', 10),
  ('api',         '{"fr":"API et SDK","en":"API and SDK"}', 20),
  ('llm_gateway', '{"fr":"Accès aux modèles","en":"Model gateway"}', 30),
  ('mcp_runtime', '{"fr":"Serveurs MCP","en":"MCP servers"}', 40),
  ('agents',      '{"fr":"Agents","en":"Agents"}', 50),
  ('payments',    '{"fr":"Paiements","en":"Payments"}', 60)
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform.api_versions (version, status, released_at) VALUES ('v1', 'beta', '2026-10-01')
ON CONFLICT (version) DO NOTHING;
