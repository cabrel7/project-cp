---
description: Audit du code existant de project-cp contre les invariants (CLAUDE.md + guard-rules.tsv), délégué au reviewer
---
Délègue au subagent **reviewer** : audit du code EXISTANT contre les invariants de project-cp.
1. Pour chaque règle de `.claude/guard-rules.tsv` : `grep -rnE` sur les sources correspondant aux globs
   (hors node_modules, dist, .output, .nuxt, .turbo, docs/, .claude/). Liste les violations.
2. Pour chaque invariant de `CLAUDE.md` sans règle mécanique (RLS via withOrgContext, réservation de crédits avant appel,
   approbation suppression/financier, i18n, glossaire, états UI…) : vérifie par lecture ciblée + PROPOSE la règle grep à ajouter au TSV
   quand c'est mécanisable.
3. Invariants transversaux : vérifie TOUTES les entités concernées (chaque route qui débite, chaque table client, chaque écran de liste).
4. Migrations : chaque fichier de `db/migrations/` a up + down ; `squawk` sur l'ensemble.
Corrige CRITICAL/MAJOR directement (tests relancés, sortie brute), liste MINOR. Termine par le décompte par invariant et mets à jour `PROJECT_STATE.md` (Known issues).
