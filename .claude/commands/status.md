---
description: Vérifie et met à jour PROJECT_STATE.md contre le code réel de project-cp
---
Lis `PROJECT_STATE.md` et vérifie-le contre le dépôt réel :
1. ✅ Done correspond-il aux fichiers existants (apps/, packages/, db/migrations/, infra/) ?
2. Affine 🔄 Active (fait / manquant), en citant les fichiers.
3. Réordonne 📋 Queue par priorité et dépendances (le plan de construction `docs/reference/08-plan-construction.md` fait foi s'il existe).
4. Ajoute les ⚠️ Known issues détectés (tests rouges, TODO bloquants, écarts avec `docs/reference/`).
5. 🏗️ Decisions : ne recopie pas le journal ; pointe vers `docs/reference/06-journal-decisions.md`.
6. Écris la version à jour (date + session). Affiche : X faites / Y en cours / Z en queue + tâche active.
Si PROJECT_STATE.md n'existe pas, crée-le en analysant le dépôt.
