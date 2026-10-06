---
description: Développe une feature project-cp de bout en bout avec le pipeline d'agents (architect → database → backend → frontend → tester → reviewer, + ux-reviewer / e2e-tester)
argument-hint: "<description de la feature>"
---
Feature demandée : $ARGUMENTS

Tu es l'ORCHESTRATEUR. Tu délègues, tu n'implémentes pas toi-même. Protocole : `CLAUDE.md` § PROTOCOLE DE TRAVAIL (tier critique).
Les agents ci-dessous sont **impératifs** ; chaque livrable d'agent commence par `Skills lus : …`, sinon tu le renvoies.

1. **Cadrage** — lis `PROJECT_STATE.md`, `PROJECT_CONTEXT.md` (tier), `docs/reference/00-index.md` et le lot dans
   `docs/reference/08-plan-construction.md`. Contradiction avec 06 ou information critique manquante → question AVANT tout.
2. **architect** — spec complète + critères d'acceptation `CA-n` (Étant donné / Quand / Alors, couche de test indiquée).
   Résumé 5 lignes ; attends ma validation si elle ajoute une table, une route publique ou une décision.
3. **tester (RED)** — écrit les tests des `CA-n` (unitaires, intégration PostgreSQL/Redis réels, routes) et montre
   qu'ils échouent pour la bonne raison (sortie brute). Ajoute l'étape CI si un test d'intégration n'y tourne pas.
4. **database (GREEN)** — si la spec change le schéma : tests SQL rouges → migration → vert, `drizzle-kit pull`, sortie brute.
5. **backend (GREEN)** — code jusqu'au vert des tests RED, sans toucher aux assertions ; `openapi.json` si une route change.
   Plus de 3 cycles RED→GREEN sans succès → retour à l'architect.
6. **frontend** — s'il y a de l'interface : lit 2-3 composants similaires + maquette + contrat zod, puis gabarit,
   composants, i18n fr/en, glossaire Simple/Technique ; tests composant après.
7. **tester (compléments)** — cas oubliés (isolation 2 organisations, plan, flag, crédits, idempotence, concurrence).
8. **reviewer** (opus) — invariants + sécurité + contrôles de process ; CRITICAL/MAJOR corrigés puis tests relancés.
9. **regression-checker** en parallèle de 8 si l'existant change ; s'il y a de l'interface : **ux-reviewer**, puis
   **e2e-tester** (clair, sombre, mobile) et planche de comparaison aux maquettes dans `docs/review/`.

Règles :
- Lance en parallèle ce qui est indépendant (ex. frontend dès que les schémas zod de `@cp/shared` sont posés).
- Rien n'est « terminé » sans sortie brute verte, **avec** `passés / échoués / sautés` et raison de chaque saut.
  Tests PostgreSQL/Redis : `pnpm infra:up` (mode natif sans Docker) puis exécution réelle — jamais « tournera en CI ».
- Fin : `PROJECT_STATE.md` à jour ; nouvelle décision → journal 06 (signalée) ; erreurs évitables → `ISSUES.log` ;
  ouvre la PR vers `dev` (jamais `main`, jamais de fusion par toi) ; donne-moi : fichiers touchés, preuves (sorties),
  limites connues, prochaine étape.
