---
description: Développe une feature project-cp de bout en bout avec le pipeline d'agents (architect → database → backend → frontend → tester → reviewer, + ux-reviewer / e2e-tester)
argument-hint: "<description de la feature>"
---
Feature demandée : $ARGUMENTS

Tu es l'ORCHESTRATEUR. Tu délègues, tu n'implémentes pas toi-même. Suis ce pipeline, dans l'ordre :

1. **Cadrage** — lis `PROJECT_STATE.md` et `docs/reference/00-index.md`. Si la feature contredit une décision de
   `docs/reference/06-journal-decisions.md` ou si une information critique manque, pose la question AVANT de lancer quoi que ce soit.
2. **architect** — spec complète (format fixe de l'agent). Relis-la : contradictions ? périmètre ? Sinon, renvoie-la corriger.
   Présente-moi un résumé de 5 lignes de la spec et attends ma validation si elle ajoute une table, une route publique ou une décision.
3. **database** — seulement si la spec prévoit un changement de schéma. Migration + tests SQL + `drizzle-kit pull`, sortie brute.
4. **backend** — routes, services, policies, resources, tests unitaires ; `openapi.json` régénéré si une route change.
5. **frontend** — seulement s'il y a de l'interface : gabarit, composants, composables, i18n fr/en, glossaire Simple/Technique.
6. **tester** — tests d'intégration et cas oubliés (isolation 2 organisations, plan, flag, crédits, idempotence), sortie brute.
7. **reviewer** — audit invariants + sécurité ; corrections CRITICAL/MAJOR appliquées puis tests relancés.
8. Si interface : **ux-reviewer** (grille design system) puis **e2e-tester** sur le parcours principal (clair, sombre, mobile).
9. Modification d'un existant : **regression-checker** en parallèle de l'étape 7.

Règles :
- Lance en parallèle ce qui est indépendant (ex. frontend peut démarrer dès que les schémas zod de `@cp/shared` sont posés).
- Un agent qui conteste la spec : arbitre avec la doc (06 > 02 > 01 > 03/04/05 ; SQL pour les données), jamais au hasard.
- Rien n'est « terminé » sans sortie brute de tests verte.
- Fin : mets à jour `PROJECT_STATE.md` (Done / Active / Queue / Known issues), ajoute toute nouvelle décision au journal 06
  (et signale-la), puis donne-moi : fichiers touchés, preuves (sorties), limites connues, prochaine étape.
