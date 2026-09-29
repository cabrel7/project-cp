---
name: cp-api-contract
description: Contrat de l'API publique project-cp (REST /v1, SDK, MCP) — identifiants UUIDv7 exposés, format d'erreur unique et catalogue de codes, pagination par curseur, idempotence, versionnement, rate limit, webhooks signés, montants et dates. Lire avant de créer ou modifier une route, un schéma zod partagé ou le SDK.
---

# Contrat d'API — project-cp

> Sources : `docs/reference/02-regles-metier.md` §8 (erreurs), §9 (droits vs flags), §4.6 (auth clients MCP) ·
> `docs/reference/04-schema-donnees.md` §2.1 (identifiants) · décisions D09, D42 dans `06-journal-decisions.md`.

## 1. Identifiants
- Exposé : **uniquement** `public_id` (UUIDv7) sous le nom `id` dans le JSON : `{ "id": "0192f…", … }`.
- Jamais d'`id` bigint, jamais d'`organization_id` interne. Références : `workspace_id`, `agent_id`… = public_id aussi.
- Préfixes lisibles seulement pour les secrets (clés `cp_live_…` / `cp_test_…`, jetons MCP) : préfixe affichable, valeur hachée en base.
- Schéma zod : `z.uuid()` (UUIDv7 validé), jamais `z.bigint()`, jamais `z.number()` pour un id.

## 2. Conventions JSON
- `snake_case` dans le JSON public (SDK multi-langages) ; conversion camelCase côté TS dans les resources.
- Dates ISO 8601 UTC (`2026-09-29T21:30:00Z`).
- Montants : crédits en **micro-crédits sous forme de string** (`"credits_used_micro": "7100000"`) + champ d'affichage optionnel ;
  argent réel `{ "amount_minor": "25000", "currency": "XAF" }` (XAF/XOF sans décimales). Jamais de flottant.
- Statuts : chaînes en minuscules du schéma (`queued`, `running`, `awaiting_approval`…).
- i18n : les champs traduisibles sont renvoyés dans la langue demandée (`Accept-Language`), l'objet complet en mode admin.

## 3. Erreurs (format unique)
```json
{ "error": { "code": "MCP_TOOL_INPUT_INVALID", "message": "Le paramètre « montant » est invalide.",
  "details": { "field": "montant" }, "request_id": "req_…", "documentation_url": "https://…/errors/MCP_TOOL_INPUT_INVALID" } }
```
- Codes du catalogue `platform.error_codes` (familles AUTH, BILLING, MCP, AGENT, LLM, MARKET, WEBHOOK, IDEMPOTENCY, PLATFORM) :
  statut HTTP, message FR/EN, indice, **relançable ?**, **rembourse ?**. Nouveau code = migration de données + enum `@cp/shared/errors` + traductions.
- Distinction obligatoire : `PLATFORM_FEATURE_NOT_AVAILABLE` (plan) vs `PLATFORM_FEATURE_DISABLED` (flag).
- Ordre de vérification : **flag → droit de plan → surcharge client → budget / crédits**.
- Statuts : 400 (requête mal formée), 401, 403, 404 (aussi pour une ressource d'une autre organisation — ne jamais révéler son existence),
  409 (conflit de version `lock_version`, état), 422 (validation), 429 (+ `Retry-After`), 402 non utilisé (crédits → 403/409 + code BILLING_*),
  5xx sans détail interne.

## 4. Pagination, tri, filtres
- Curseur opaque : `?limit=25&cursor=…` → `{ "data": [...], "next_cursor": "…" | null }` ; `limit` ≤ 100.
- Curseur = encodage (base64url) de `(created_at, public_id)` ; tri stable.
- Filtres explicites et typés (`?status=running&agent_id=…`), pas de langage de requête libre.

## 5. Idempotence
- En-tête `Idempotency-Key` (UUID) **obligatoire** sur : création de ressource, `ai.run` / exécution d'agent, paiement, achat Marketplace, toute action qui débite.
- Même clé + même corps → même réponse (rejouée) ; même clé + corps différent → `IDEMPOTENCY_KEY_REUSED` (422) ; conservée 24 h.
- Webhooks entrants (paiements) dédupliqués par identifiant d'événement.

## 6. Versionnement
- Préfixe `/v1`. Changements additifs seulement dans une version. Cassant → nouvelle version + dépréciation annoncée
  (`platform.api_versions`, en-têtes `Deprecation` / `Sunset`).
- Les serveurs MCP publiés et les versions de capacités/agents sont **figés** : un changement = nouvelle version.

## 7. Authentification et portées
- Dashboard : session cookie HttpOnly. SDK / API : clé liée à UN environnement, portées, IP et origines autorisées (D42 : une clé par app/outil).
- Les clés appellent **nos capacités** (`POST /v1/capabilities/{slug}/run` ≡ `ai.run`), jamais un modèle brut (D09).
- MCP : OAuth 2.1 (Claude, ChatGPT) ou jeton statique (Cursor, Claude Desktop).

## 8. Rate limit
En-têtes `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` ; 429 + `Retry-After`. Politiques dans `platform.rate_limit_policies`.

## 9. Webhooks sortants
- Signature HMAC-SHA256 : en-tête `cp-signature: t=<ts>,v1=<hex>` sur `t.body` ; tolérance 5 min ; secret par endpoint.
- Livraison au moins une fois, `event_id` unique, relances exponentielles, journal des livraisons (`dev` schéma).

## 10. Streaming
SSE (`text/event-stream`) pour les runs et `ai.run` en flux : événements `run.step`, `run.approval_required`, `run.completed`, `error` ;
`id:` sur chaque événement pour la reprise (`Last-Event-ID`).

## Checklist d'une nouvelle route
- [ ] Schémas zod dans `@cp/shared` (entrée + sortie + erreurs), exemples OpenAPI
- [ ] Ids = UUID public, montants en string µcr, dates ISO
- [ ] Portée requise, policy (flag → plan → surcharge → budget), 404 inter-organisations
- [ ] Idempotence si création/débit ; pagination curseur si liste
- [ ] Codes d'erreur du catalogue documentés dans `responses`
- [ ] `openapi.json` régénéré, client front et SDK régénérés
