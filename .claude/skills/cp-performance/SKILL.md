---
name: cp-performance
description: Performance de project-cp — budgets de latence (API, runtime MCP, garde-fous), PostgreSQL (index, partitions, EXPLAIN, N+1), Redis (cache de configuration, compteurs), coûts IA, front Nuxt léger pour réseaux mobiles africains (Core Web Vitals, bundle, SSR/ISR, images, polices). Lire avant d'optimiser ou d'auditer la performance.
---

# Performance — project-cp

## Méthode (toujours)
1. **Mesurer** (OTel/Grafana, `EXPLAIN (ANALYZE, BUFFERS)`, Lighthouse en profil mobile 4G lente) — jamais de supposition.
2. Trouver le vrai goulot (souvent 1 requête, 1 appel externe, 1 import).
3. Corriger, **re-mesurer**, prouver le gain chiffré (avant / après dans le livrable).

## Budgets de latence (p95, hors temps du modèle / du système client)
| Chemin | Budget |
|---|---|
| API lecture simple | < 80 ms |
| Surcoût plateforme d'un `tools/call` MCP (auth → policy → exécuteur) | < 50 ms |
| Garde-fous entrée (règles + modèle local), en parallèle de l'appel modèle | < 40 ms |
| OPA wasm par action | < 5 ms |
| Réservation + régularisation de crédits | < 15 ms |
Chaque détecteur a un budget de latence propre (05 §2).

## Base de données
- Index pour chaque requête fréquente (filtre + tri) ; pagination curseur indexée `(organization_id, created_at, public_id)`.
- RLS : les policies utilisent `util.current_org_id()` (STABLE) — garder `organization_id` en tête des index composites.
- Tables partitionnées : toujours filtrer sur la clé de partition (élagage) ; `usage.find_run(public_id)` pour retrouver un run.
- Pas de N+1 (jointures, `inArray`) ; pas de `SELECT *` sur les grosses tables ; `count(*)` exact évité sur les listes (estimation ou « plus de 1000 »).
- Pool `postgres.js` dimensionné par processus (VPS 8 vCores : total < `max_connections` − marge) ; transactions courtes (jamais d'appel réseau dedans).

## Redis
Configuration active des serveurs MCP et capacités en cache (invalidée par l'outbox) ; budgets et rate limit en compteurs atomiques (Lua) ;
arrêts d'urgence et disjoncteurs en Redis ; TTL explicites ; aucune donnée client sans préfixe d'organisation.

## Coûts IA (la « performance » qui coûte de l'argent)
Profil le moins cher qui réussit l'évaluation ; cache de prompt quand le fournisseur le permet (préfixe stable des consignes) ; compression du
contexte (`system.context.compress`) ; juge IA échantillonné ; verdicts de garde-fous mis en cache par empreinte.

## Front (réseaux mobiles d'abord)
- Cibles : LCP < 2,5 s en 4G lente, INP < 200 ms, CLS < 0,1 ; JS initial des pages mobiles (chat, approbations, portefeuille) < 170 Ko gzip.
- `routeRules` : pages marketing/docs en ISR, dashboard en SSR léger ou SPA selon la page ; composants lourds (`vue-echarts`, `@vue-flow/core`,
  CodeMirror, shiki) en import dynamique (`LazyX`, `defineAsyncComponent`) uniquement sur les écrans qui les utilisent.
- `@nuxt/image` (AVIF/WebP, dimensions fixées), `@fontsource` (D56 : sous-ensemble latin, `font-display: swap`, préchargement de Geist seulement).
- Listes longues virtualisées ; SSE plutôt que polling ; tolérance aux coupures (reprise `Last-Event-ID`).
- Analyse du bundle : `nuxi analyze`.

## Anti-patterns
Optimisation sans mesure · appel réseau dans une transaction · cache sans invalidation · requête sans filtre de partition sur une table partitionnée ·
bibliothèque de graphiques chargée sur toutes les pages · polling agressif sur mobile.
