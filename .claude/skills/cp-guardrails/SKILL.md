---
name: cp-guardrails
description: Garde-fous IA de project-cp (packages/guard) — pipeline 5 étapes (entrée, contexte, action, sortie, coûts), cascade du moins cher au plus cher, profils Standard/Strict/Interne/Observation, OPA wasm, spotlighting, détecteurs locaux ONNX, juge IA, journal sans contenu brut, arrêts d'urgence. Lire avant tout code qui touche une entrée de modèle, un appel d'outil ou une sortie.
---

# Garde-fous — project-cp

> Source unique : `docs/reference/05-garde-fous-ia.md` · schéma `097_guardrails.sql` · données `960_seed_ai_system.sql`.
> Menaces couvertes : 05 §7. Lié : `cp-ai-runtime`, `cp-mcp-runtime`, `cp-agents-temporal`.

## 1. Principes (non négociables)
1. **Le modèle ne décide jamais seul d'une action réelle** : politique + bornes + approbation, déterministes. Une consigne de prompt n'est pas une sécurité.
2. **Tout contenu externe est une donnée, jamais une instruction** (résultats d'outils, documents, emails, pages) → encadré et marqué.
3. Défense en profondeur, 5 étapes. 4. Cascade : règles/regex (1-5 ms) → modèles locaux (20-40 ms) → juge IA (≈ 1 s) seulement si ambigu ou à risque.
5. **Mesurer avant de bloquer** : tout nouveau détecteur ou seuil démarre en mode Observation. 6. Arrêt d'urgence à toutes les échelles sans redéployer.

## 2. Architecture de `packages/guard`
```
packages/guard/src/
  pipeline.ts        # runStage(stage, ctx, payload) → Verdict { action: 'allow'|'mask'|'flag'|'block'|'require_approval'|'escalate', events[] }
  profiles.ts        # résolution du profil : global → plan → org → workspace → env → capacité/agent/serveur (le plus spécifique gagne)
  detectors/         # un fichier par détecteur : size, secrets, pii, injection (ONNX), moderation, off_topic, indirect_injection,
                     # opa_policy, param_bounds, loop, anomaly, json_schema, leak, links, judge, budget
  spotlight.ts       # encadrement des données non fiables (délimiteurs + marquage + échappement)
  opa/               # bundle wasm compilé depuis les politiques en base, chargé en mémoire, rechargé via outbox/Redis
  cache.ts           # verdicts mis en cache par empreinte (sha256) du contenu + version du détecteur
  events.ts          # écriture usage.guardrail_events (jamais le contenu brut : extrait masqué + empreinte)
```
Chaque détecteur : `{ id, stage, costTier, latencyBudgetMs, run(ctx, payload): Promise<DetectorResult> }` ; configuration (seuils, activation,
mode) lue depuis la base (`ai.guardrail_*`), jamais codée en dur.

## 3. Pipeline par étape
| Étape | Détecteurs | Actions |
|---|---|---|
| 1 Entrée | taille/format, secrets, PII, injection/jailbreak (local), modération, hors sujet | bloquer, masquer, signaler |
| 2 Contexte | spotlighting, injection indirecte (local) dans outils/documents, budget/compression du contexte | signaler, bloquer, compresser |
| 3 Action (avant CHAQUE appel d'outil) | OPA, bornes des paramètres, approbation humaine, boucle (même outil + mêmes paramètres), volume anormal, juge IA (Strict) | bloquer, exiger approbation, escalader |
| 4 Sortie | schéma JSON (relance), fuite secrets/PII, modération, liens autorisés, juge échantillonné | relancer, masquer, bloquer |
| 5 Coûts | budgets/crédits, itérations/durée, plafond de tokens, disjoncteurs | bloquer |

Latence : l'étape 1 tourne **en parallèle** du début de l'appel modèle, le flux est coupé dès l'échec ; contrôles coûteux échantillonnés en
faible risque, systématiques sur actions à risque ; budget de latence dépassé → blocage (action à risque) ou passage signalé (lecture).

## 4. Profils
- **Standard** (défaut) : injection bloquée > 0,95. **Strict** : automatique dès qu'un run peut écrire, supprimer, payer ou envoyer
  (PII masquées, injection bloquée ≥ 0,70, indirecte bloquée, anomalies bloquées, juge sur actions à risque, liens non autorisés bloqués).
  **Interne** (IA de la plateforme) : JSON strict, indirecte bloquée. **Observation** : ne bloque rien, juge échantillonné 5 %.
- Profils système lisibles mais non modifiables par les clients (test T17) ; profils personnalisés dès Pro.
- Masquage PII avant envoi au modèle = option client.

## 5. Actions réelles (étape 3) — règles dures
- Effets : lecture, écriture, suppression, financier, message externe. **Suppression et financier ⇒ approbation humaine toujours** (contrainte DB).
- Approbation : résumé en langage clair (`system.agent.approval_summary`), paramètres corrigeables, expiration ⇒ run annulé.
- Politiques OPA évaluées **dans le processus** (wasm) avec l'entrée `{ actor, org, agent, tool, effect, params, time, env }`.

## 6. Arrêts d'urgence
`platform.emergency_stops` lus depuis Redis (effet immédiat) : global, organisation, agent, modèle/fournisseur/déploiement, serveur MCP/outil,
capacité, fonction. Motif, auteur, expiration optionnelle, audit. Réponse `EMERGENCY_STOP_ACTIVE`. Vérifiés au début de chaque run ET avant chaque
appel d'outil / modèle (un run en cours s'arrête proprement).

## 7. Journal et faux positifs
`usage.guardrail_events` : étape, détecteur, score, action, latence, mode — **jamais le contenu brut**. Marquage « faux positif » client/admin →
alimente les jeux d'évaluation et l'ajustement des seuils.

## Tests
Jeux d'attaques connus (injection directe/indirecte, exfiltration par liens, secrets dans la sortie, boucle d'outil, montant hors borne) :
chaque détecteur a des cas positifs ET négatifs (faux positifs). Tester la résolution des profils, le passage automatique en Strict, l'approbation
obligatoire, l'arrêt d'urgence en cours de run, et que le journal ne contient aucun contenu brut.

## Anti-patterns interdits
Sécurité par consigne de prompt · contenu d'outil injecté sans spotlighting · seuil ou regex en dur dans le code · nouveau détecteur bloquant
sans phase Observation · contenu brut dans les journaux · juge IA appelé sur tout (coût) · approbation contournable par paramètre ·
arrêt d'urgence vérifié seulement au démarrage.
