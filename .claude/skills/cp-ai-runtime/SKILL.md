---
name: cp-ai-runtime
description: AI Runtime de project-cp — capacités (ai.run) versionnées avec prompts en base, résolution du modèle et routage (D45/D46, profils Flash/Smart/Max, BYOK, bascule dans le même profil), LiteLLM + Vercel AI SDK, streaming, sortie structurée, réservation de crédits, traçabilité routing_source/fallback_reason, Prompt Studio, IA interne (organisation 0). Lire avant tout code qui appelle un modèle.
---

# AI Runtime — project-cp

> Sources : `docs/reference/02-regles-metier.md` §5 bis (capacités, résolution, bascule) et §3 (crédits) ·
> `docs/reference/01-specification-produit.md` §3.2 · `docs/reference/05-garde-fous-ia.md` §6 (IA interne) ·
> `docs/reference/04-schema-donnees.md` §7.5 · décisions D09, D43-D47 · schéma `db/schema-v1.2/040_ai.sql`, `075_usage.sql`.

## 1. Invariants
- **Aucun endpoint compatible OpenAI** exposé (D09). Les clients appellent des **capacités** : `POST /v1/capabilities/{slug}/run` (SDK `ai.run`), via MCP ou depuis un agent.
- **Aucun prompt système en dur** : consignes, gabarit, schéma de sortie, profil, garde-fous vivent dans `ai.capability_versions`.
  L'IA interne (organisation 0, capacités `system.*`, seed `960_seed_ai_system.sql`) suit la même règle.
- Tout appel modèle passe par LiteLLM (clés fournisseurs dans l'environnement de LiteLLM, BYOK dans Infisical) — jamais un SDK fournisseur direct.
- Tout appel est un **run** (ou une étape de run) : réservation de crédits avant, régularisation après, garde-fous autour, trace complète.

## 2. Exécuter une capacité — séquence
```
resolveCapability(slug, env)        → version en production pour l'environnement (A/B éventuel, déterministe par run)
checkAccess(auth)                   → flag → plan → surcharge → visibilité (private/organization/public installée) → arrêt d'urgence
resolveModel(version, auth)         → §3 (retourne candidats ordonnés + routing_source)
guard.input(...)                    → étape 1 du pipeline (en parallèle du début de l'appel)
billing.reserve(estimate)           → réservation portefeuille + budgets (refus si insuffisant)
callWithFallback(candidates)        → §4, AI SDK sur LiteLLM, streaming possible
guard.output(...)                   → schéma JSON (relance), fuite de secrets/PII, modération
billing.settle(actualUsage)         → coût réel, taux de change et coefficient enregistrés
record(llm_request, run_step)       → modèle, routing_source, rule, fallback_reason, tokens, latence, coût
```
Le rendu du prompt : gabarit de la version + variables validées par le schéma d'entrée de la capacité ; les données
utilisateur sont **encadrées et marquées** (spotlighting), jamais concaténées dans les consignes.

## 3. Résolution du modèle (D45) — le plus précis l'emporte
1. **Modèle fixé** sur la version (capacité ou agent) — mode Technique, plan **Pro+** (`ai.model_override`), modèle autorisé par le plan.
2. **Profil** de la capacité / de l'agent (Flash / Smart / Max, profil personnalisé dès Pro).
3. **Profil par défaut** du workspace, puis de l'organisation (`default_routing_profile_id`).
4. **Défaut du plan** : Flash (Free), Smart (autres).
- Profil demandé hors plan → `PLATFORM_FEATURE_NOT_AVAILABLE`, **jamais rétrogradé en silence**.
- Candidats d'un profil filtrés par : fonctions requises (outils, JSON, vision, audio), taille d'entrée ≤ contexte, **région de données**,
  modèles `BYOK uniquement` (`LLM_MODEL_BYOK_ONLY` sans clé). **BYOK prioritaire** si clé valide chez le fournisseur retenu
  (crédits infra seulement). Ordre final : règles de routage admin (conditions, ordre, poids).
- `routing_source` ∈ { `model_override`, `capability`, `agent`, `workspace`, `organization`, `plan` } ;
  `fallback_reason` ∈ { `unavailable`, `timeout`, `rate_limited`, `provider_error`, `circuit_open`, `context_too_long` }
  (CHECK de `usage.llm_requests` — le SQL fait foi, réutiliser les constantes de `@cp/shared`).

## 4. Bascule (D46)
- Déclencheurs : indisponible, délai dépassé, limite de débit, erreur fournisseur, disjoncteur ouvert, contexte trop long.
- Vers le **candidat suivant du même profil**, mêmes contraintes (fonctions, région, budget). **Jamais vers un profil plus cher.**
- Modèle fixé indisponible : défaut = bascule vers le profil + signalement ; option `model_fallback = 'fail'` (mode Technique) → erreur.
- **Constance** : un agent garde le même modèle pendant tout un run, sauf bascule (mémoriser le choix dans le run).
- Chaque bascule enregistre `fallback_reason` ; l'UI affiche « Modèle utilisé : X (profil Équilibré) ».
- Résilience : `cockatiel` (timeout, retry sur 429/5xx avec backoff, circuit breaker par déploiement, état partagé Redis).

## 5. Appel via AI SDK + LiteLLM
```ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
const litellm = createOpenAICompatible({ name: 'litellm', baseURL: env.LITELLM_URL, apiKey: env.LITELLM_MASTER_KEY })
// BYOK : clé récupérée dans Infisical au moment de l'appel, passée à LiteLLM par requête (jamais loguée)
const result = streamText({
  model: litellm(deployment.litellmModelName),
  messages: renderMessages(version, input),          // consignes depuis la version en base
  tools, maxOutputTokens: version.maxTokens, temperature: version.temperature,
  abortSignal, experimental_telemetry: { isEnabled: true, functionId: capability.slug },
})
```
- `baseURL` pointe vers LiteLLM **interne** : c'est un appel sortant, pas un endpoint exposé (pas de conflit avec D09).
- Sortie structurée : `generateObject` / `Output.object` avec le schéma JSON de la version (ajv côté garde-fous), relance automatique limitée.
- Coût : usage renvoyé par LiteLLM × prix daté du déploiement (`ai.model_prices`) × taux USD→XAF × coefficient du plan → µcr (bigint, `@cp/billing`).

## 6. Versions, Prompt Studio, évaluations
- Version = consignes + gabarit + variables + schéma de sortie + profil/modèle + `model_fallback` + garde-fous ; **publiée = verrouillée** (trigger).
- Mise en production par environnement ; A/B (pourcentage) ; retour arrière en un clic ; seuil d'évaluation (`min_eval_score`) :
  **aucune mise en production sous le seuil, sans contournement** (IA interne comme clients Pro+ qui l'activent).
- Évaluations : jeux de cas, notation par `system.eval.grader` + règles déterministes, score par version, comparaison.
- Capacité scellée (Marketplace, D47) : l'acheteur l'exécute sans jamais lire le prompt ; les resources n'exposent pas les consignes.

## 7. Capacités appelées par un agent (D43)
Accordées à la **version** de l'agent (`agent.capability_grants` : autoriser / approbation / refuser), même organisation (test T19).
Appel = outil pour le modèle, tracé comme étape `capability_call` du run parent, facturé dans le même run.

## Tests
MSW pour simuler LiteLLM (succès, 429, 5xx, timeout, contexte trop long) ; vérifier : ordre de résolution, refus hors plan, bascule dans le profil,
jamais plus cher, `model_fallback='fail'`, constance sur un run, `routing_source`/`fallback_reason` enregistrés, crédits réservés puis régularisés,
remboursement sur erreur plateforme.

## Anti-patterns interdits
Route `/chat/completions` · prompt dans le code · appel direct OpenAI/Anthropic SDK · modèle choisi « en dur » dans un service ·
bascule vers Max depuis Smart · appel sans réservation de crédits · `number` flottant pour un coût · log du prompt/contenu brut
(journal = extrait masqué + empreinte) · prompt scellé renvoyé à l'acheteur.
