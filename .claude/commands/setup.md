---
description: Prépare l'environnement de travail project-cp (session cloud ou machine neuve) et affiche l'état de l'outillage
allowed-tools: Bash(bash .claude/scripts/setup-cloud.sh:*)
---
Prépare l'environnement :

!`bash .claude/scripts/setup-cloud.sh`

À partir de la sortie : résume en 3 lignes ce qui est prêt, ce qui manque et l'impact (ex. « pas de Docker → tests Testcontainers
en CI seulement »). Ne relance pas le script dans le même tour. Rappel : ne jamais lancer `playwright install` (Chromium préinstallé en cloud).
