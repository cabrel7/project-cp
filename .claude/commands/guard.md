---
description: Transforme un invariant project-cp en règle bloquante dans .claude/guard-rules.tsv (et la teste)
argument-hint: "<invariant en langage clair>"
---
Transforme cet invariant en règle mécanique : $ARGUMENTS

1. Traduis en : GLOBS inclus (chemins absolus, ex. `*/apps/api/*.ts`) · GLOBS exclus (`-` si aucun ; exclure au minimum
   `*node_modules*` et les tests si pertinent) · REGEX `grep -E` qui détecte la VIOLATION · MESSAGE (`NOM: problème → correction`).
2. Ajoute la ligne à `.claude/guard-rules.tsv` avec de VRAIES tabulations :
   `printf '%s\t%s\t%s\t%s\n' "<globs>" "<exclus>" "<regex>" "<message>" >> .claude/guard-rules.tsv`
3. TESTE avec le hook du projet (il s'efface si le hook global v4 est actif ; pour le test, force-le avec `HOME=/tmp`) :
   ```bash
   echo '{"tool_input":{"file_path":"'$PWD'/apps/api/src/x.ts","content":"<code violant>"}}' \
     | HOME=/tmp CLAUDE_PROJECT_DIR=$PWD bash .claude/hooks/cp-guard-pretool.sh; echo "exit=$?"
   ```
   → attendu `exit=2` ; puis avec un code conforme → `exit=0`.
4. Passe la regex sur le code existant (`grep -rnE`) : faux positifs ? Affine la regex ou les exclusions.
5. Si l'invariant n'est pas encore dans `CLAUDE.md` (section INVARIANTS), propose l'ajout. Confirme le résultat avec les sorties.
