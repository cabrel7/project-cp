---
name: cp-agents-temporal
description: Agent Runtime de project-cp — agents exécutés en workflows Temporal (apps/agent-worker), activités (modèle, outils MCP, capacités, mémoire), approbations par signal, limites (itérations, durée, profondeur ≤ 5, horaires), accès granulaires et capacités accordées par version, cycle de vie des runs, rejeu. Lire avant tout code d'agent ou de run.
---

# Agents et Temporal — project-cp

> Sources : `docs/reference/02-regles-metier.md` §1.2 (cycle agent), §1.4 (run), §5 (configuration et limites), §5 bis (routage, D43) ·
> `docs/reference/01-specification-produit.md` §3.4 · schéma `060_agent.sql`, `075_usage.sql` · maquettes page 5 (Agent Studio, exécution).

## 1. Modèle
Agent = objectif + instructions + accès (serveurs MCP / outils / **capacités** : autoriser / approbation / refuser) + déclencheur + politique + limites.
Toute modification d'un agent `DRAFT`/`PAUSED` crée une **nouvelle version** ; un run s'exécute sur UNE version figée.

## 2. Workflow Temporal (déterministe)
```ts
// apps/agent-worker/src/workflows/agent-run.ts — AUCUNE E/S ici : seulement des activités
export async function agentRun(input: AgentRunInput): Promise<AgentRunResult> {
  const limits = input.limits                      // itérations ≤ 50, durée ≤ 30 min, profondeur ≤ 5
  let approval: ApprovalDecision | undefined
  setHandler(approvalSignal, (d) => { approval = d })
  setHandler(cancelSignal, () => { cancelled = true })
  for (let i = 0; i < limits.maxIterations; i++) {
    const step = await acts.llmStep({ runId, iteration: i })          // modèle choisi au 1er pas puis constant (sauf bascule)
    if (step.final) return acts.finalize({ runId, output: step.output })
    for (const call of step.toolCalls) {
      const check = await acts.checkAction({ runId, call })           // policy, bornes, boucle, anomalie, juge (Strict)
      if (check.action === 'require_approval') {
        await acts.markAwaitingApproval({ runId, call, summary: check.summary })
        const ok = await condition(() => approval !== undefined || cancelled, limits.approvalTimeout) // défaut 24 h
        if (!ok || cancelled || approval?.decision === 'reject') return acts.cancel({ runId, reason: 'approval_expired_or_rejected' })
        call.params = approval.params ?? call.params                  // l'humain peut corriger les paramètres
        approval = undefined
      }
      await acts.executeTool({ runId, call })                         // MCP (mcp-runtime) ou capacité (capability_call)
    }
  }
  return acts.fail({ runId, code: 'AGENT_MAX_ITERATIONS' })
}
```
- Workflows **déterministes** : pas de `Date.now()`, `Math.random()`, réseau, base ; utiliser `workflow.now()`, `uuid4()` de Temporal, activités.
- Activités idempotentes (clé = `runId + step`), timeouts et `retryPolicy` explicites ; erreurs non relançables marquées (`ApplicationFailure.nonRetryable`).
- Durée max : `workflowExecutionTimeout` = limite de l'agent ; annulation = signal + `CancellationScope`.
- Versionnement du code de workflow : `patched()` pour tout changement sur des runs en cours.

## 3. Cycle de vie d'un run (02 §1.4)
`QUEUED → RUNNING → COMPLETED` ; branches `AWAITING_APPROVAL → RUNNING`, `FAILED`, `TIMEOUT`, `CANCELLED`, `BUDGET_EXCEEDED`.
- QUEUED annulé ⇒ aucun débit ; FAILED/TIMEOUT/CANCELLED ⇒ seulement le consommé ; AWAITING_APPROVAL ⇒ aucune consommation.
- Run terminé ne reprend pas ; **rejouer** = nouveau run (`replay_of_run_id`).
- Chaque étape (`usage.run_steps`, `step_type` : llm_call, tool_call, capability_call, approval, memory_*, notification, routing, guardrail,
  sub_run, error, final) est écrite par les activités et diffusée en SSE.

## 4. Limites et règles (02 §5)
Itérations défaut 10 / max 50 · durée défaut 5 min / max 30 min · timeout d'outil ≤ 120 s · profondeur ≤ 5 (`AGENT_NESTING_TOO_DEEP`) ·
horaires autorisés (`AGENT_OUTSIDE_ALLOWED_HOURS`) · budget par run (arrêt ou demande d'autorisation) · température défaut 0,3 ·
sortie JSON ⇒ schéma obligatoire.
Sur soi-même : autorisé (lire son historique, écrire sa mémoire, notifier) ; interdit par défaut (déclencher/modifier d'autres agents) ;
**toujours interdit** (s'appeler en boucle, autre organisation, lire le coffre, contourner une approbation).
Capacités accordées par version (`agent.capability_grants`), même organisation (T19).

## 5. Déclencheurs
Manuel, planifié (`cron-parser`, Temporal Schedules), webhook entrant signé, événement interne, message de chat. Chaque déclenchement
passe par : arrêt d'urgence → flag → plan → budget/crédits → horaires → démarrage (`workflowId = run public_id`, idempotent).

## 6. Mémoire
Portée agent ou workspace, rétention selon le plan ; écrite par activité ; contenu traité comme donnée non fiable à la relecture (spotlighting).

## Tests
`@temporalio/testing` (`TestWorkflowEnvironment.createTimeSkipping()`) : approbation accordée / refusée / expirée (saut de 24 h), correction des
paramètres, max itérations, timeout, annulation pendant l'attente, profondeur 6 refusée, horaire interdit, rejeu ; activités testées seules avec MSW.

## Anti-patterns interdits
E/S dans un workflow · modèle rechoisi à chaque pas · approbation contournable · run modifié après la fin (au lieu de rejouer) · limites non bornées ·
agent qui lit le coffre · capacité appelée sans grant de la version · débit pendant l'attente d'approbation.
