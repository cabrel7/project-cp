---
name: cp-mcp-runtime
description: Action Runtime de project-cp — connecteurs (packages/connectors), MCP Builder (validation 5 étapes, versions figées), runtime MCP unique piloté par configuration (apps/mcp-runtime, @modelcontextprotocol/sdk), séquence d'un appel d'outil, connecteur base de données sans SQL libre, fiabilité (timeouts, relances, disjoncteur), auth des clients MCP. Lire avant tout code MCP ou connecteur.
---

# MCP et connecteurs — project-cp

> Sources : `docs/reference/02-regles-metier.md` §1.1 (cycle de vie serveur), §1.3 (connecteur), §4 (MCP complet) ·
> `docs/reference/01-specification-produit.md` §3.3 · schéma `050_mcp.sql`, `055_oauth.sql` · maquettes page 4 (MCP Builder).
> Garde-fous → `cp-guardrails` ; auth OAuth 2.1 → `cp-auth`.

## 1. Principe
**Un seul service** (`apps/mcp-runtime`) sert tous les serveurs : `mcp.<domaine>/{serveur}`. Aucun code généré, aucun déploiement par client :
un serveur = une **configuration versionnée** (outils, schémas, connecteur, politiques). Version publiée **immuable** (trigger) ; un changement
= nouvelle version sémantique ; un agent peut épingler une version ; coexistence pendant une transition.

## 2. Séquence d'un appel `tools/call` (ordre exact, 02 §4.2)
```
1. jeton vérifié (OAuth 2.1 / jeton statique / clé API) → organisation + utilisateur + portées
2. arrêt d'urgence (global, org, serveur, outil)
3. version active du serveur (cache Redis, invalidée par l'outbox ; repli Postgres)
4. outils filtrés par policy (+ tool routing si activé) — tools/list renvoie seulement l'autorisé
5. validation des paramètres contre le JSON Schema (ajv) → sinon 422 MCP_TOOL_INPUT_INVALID
6. policy OPA + bornes des paramètres (cp-guardrails étape 3)
7. approbation si requise (suppression / financier : toujours) → run en AWAITING_APPROVAL
8. secret récupéré dans Infisical AU MOMENT de l'appel (jamais en paramètre, log ou réponse)
9. exécuteur du connecteur (pool séparé pour SQL et connecteurs à risque) — timeout, relances, disjoncteur
10. sortie validée (schéma), nettoyée (secrets/PII), marquée comme donnée non fiable
11. audit + débit (crédits infra) + étape de run
```

## 3. Connecteurs (`packages/connectors`)
Exécuteurs : `http` (OpenAPI importé via `@scalar/openapi-parser`), `sql` (postgres, mysql2, mssql), `google`, `saas`, `files`, `mcp_external` (Bring your own MCP, SDK client).
Interface : `execute(ctx: { orgId, connector, tool, params, secret, signal }): Promise<ToolResult>` ; aucun accès direct à la base de la plateforme.
HTTP sortant via `undici` avec liste de domaines autorisés, pas de redirection vers une IP privée (SSRF), taille de réponse bornée.
Cycle de vie : `ERROR`/`REVOKED` ⇒ outils dépendants indisponibles, agents concernés en `PAUSED` + notification ; santé toutes les 15 min.

## 4. Connecteur base de données (02 §4.5) — règles dures
- **Jamais de SQL libre** : les outils sont des requêtes **paramétrées** générées à la configuration (`system.mcp.sql_templates`), **validées par
  l'utilisateur** ; le modèle ne remplit que les paramètres (`$1…`).
- Analyse syntaxique à la configuration ET à l'exécution (`libpg-query` / `node-sql-parser`) : une seule instruction, **aucun DELETE, aucun DDL**
  → `MCP_SQL_STATEMENT_REJECTED`.
- Lecture seule par défaut ; utilisateur de base dédié exigé, droits vérifiés à la connexion, **superutilisateur refusé**.
- Écriture en liste blanche : table précise, filtre par clé primaire, **une ligne max**, transaction, aperçu, approbation.
- `statement_timeout`, limite de lignes, masquage des colonnes sensibles ; bridge sortant (`mcp.bridges`, aucun port entrant) sinon IP + TLS.

## 5. MCP Builder — validation avant publication (5 étapes, 02 §4.1)
1. Structure (noms snake_case uniques, descriptions ≥ 10 caractères, JSON Schema valides) · 2. Connectivité · 3. Tests de chaque outil
(données de test, conformité du schéma de sortie) · 4. Sécurité (injection dans les descriptions, permissions déclarées = réelles) ·
5. Sémantique (`system.mcp.describe_quality`). Échec ⇒ `FAILED` + `validation_report` détaillé. Publication = fonction transactionnelle
(`@cp/db`) qui fige la version et invalide le cache.
Parcours UI (maquettes) : Système → Connexion → Actions (Simple) / Outils (Technique) → Vérification → Publication.

## 6. Fiabilité (02 §4.3)
Ping 5 min, outil de contrôle 15 min ; 3 échecs ⇒ WARNING, 5 ⇒ ERROR + agents dépendants PAUSED. Timeout par outil 30 s (max 120 s).
Relances 3 × (1 s / 3 s / 9 s) puis erreur structurée pour l'agent. Disjoncteur : > 5 échecs/min ⇒ ouvert 2 min ⇒ appel test.
Un outil en erreur n'affecte ni les autres outils ni les autres serveurs (cloisonnement `cockatiel` bulkhead par serveur).

## 7. Clients MCP (02 §4.6)
OAuth 2.1 (Claude, ChatGPT) : enregistrement dynamique, PKCE S256, indicateur de ressource, consentement par serveur et par portée, rotation des refresh
(réutilisation ⇒ révocation de la famille). Jeton statique (Cursor, Claude Desktop) : préfixe affichable, haché, portée, révocable.
Visibilité serveur : privé / organisation / public (Marketplace). Débit dépassé ⇒ 429 + `Retry-After`.

## 8. Implémentation MCP
`@modelcontextprotocol/sdk` en transport **Streamable HTTP**, sans état côté process (session reconstruite depuis le jeton + la version en cache),
monté dans Hono sur `/{serverSlug}` ; `tools/list` et `tools/call` dynamiques depuis la configuration. Métadonnées de risque (`annotations` :
readOnlyHint, destructiveHint) alignées sur l'effet déclaré.

## Tests
Chaque étape de la séquence §2 a un test de refus ; connecteur SQL : DELETE, DDL, requêtes multiples, superutilisateur, > 1 ligne → rejetés ;
disjoncteur et relances avec MSW / faux serveur ; version publiée non modifiable ; isolation (jeton de l'org A sur serveur de B ⇒ 404).

## Anti-patterns interdits
Code généré par serveur client · SQL libre ou construit par le modèle · secret dans params/logs · appel externe sans timeout · version publiée
modifiée · `tools/list` qui expose un outil non autorisé · sortie d'outil renvoyée au modèle sans nettoyage ni marquage.
