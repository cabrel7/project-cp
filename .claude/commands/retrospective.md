---
description: Analyse ISSUES.log et propose des guard-rules, des corrections de skills ou d'agents (à valider par Dylan)
---
Boucle d'apprentissage de project-cp.
1. Lis `ISSUES.log` (racine du dépôt) et, en local seulement, `~/.claude/global-issues.log` s'il existe.
2. Regroupe par cause. Classe chaque groupe :
   - violation détectable par une regex → **guard-rule** dans `.claude/guard-rules.tsv` ;
   - savoir-faire manquant → correction du **skill `cp-*`** concerné ;
   - étape de process sautée → correction de l'**agent** ou de `/feature` ;
   - pattern vu sur plusieurs projets → à remonter au système global de Dylan (ne PAS modifier `~/.claude`).
3. PRÉSENTE les propositions en ligne : « [1] … [2] … — applique : [1][2][tout][aucun] ? ». N'écris rien avant le choix.
4. Guard-rule retenue : ajoute-la puis TESTE-la (fichier violant → exit 2, fichier conforme → exit 0) avec
   `.claude/hooks/cp-guard-pretool.sh`. Skill/agent retenu : montre le diff avant d'écrire.
5. Marque les lignes traitées de `ISSUES.log` (`→ traité : <règle|skill|agent>`), sur une branche avec PR vers `dev`.
