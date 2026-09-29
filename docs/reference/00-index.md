# Index et règles de documentation

> **Nom de code :** `project-cp` · Mis à jour le 29 septembre 2026 (ajout du 08)
> Point d'entrée de tout le projet — pour toi, pour Cabrel et pour les agents Claude Code.

---

## 1. Documents de référence (à jour)

| # | Document | Répond à la question | Statut |
|---|---|---|---|
| 00 | `reference/00-index.md` | Où est quoi ? | ✅ |
| 01 | `reference/01-specification-produit.md` | **Quoi et pour qui** : mission, publics, briques, modes d'accès, plans et prix, admin, juridique, déploiement | ✅ v2 |
| 02 | `reference/02-regles-metier.md` | **Comment ça se comporte** : cycles de vie, crédits, MCP, agents, paiements, erreurs, rétention | ✅ v2 |
| 03 | `reference/03-architecture-technique.md` | **Avec quoi** : services, bibliothèques, migrations et ORM, organisation du dépôt | ✅ v1 |
| 04 | `reference/04-schema-donnees.md` | **Où sont les données** : conventions, domaines, index, partitions, sécurité | ✅ v1.2 |
| 05 | `reference/05-garde-fous-ia.md` | **Comment on garde le contrôle de l'IA** : pipeline, profils, arrêts d'urgence, IA interne | ✅ v1 |
| 06 | `reference/06-journal-decisions.md` | **Qu'a-t-on décidé, quand, et qu'est-ce que ça remplace ?** | ✅ vivant |
| 07 | `reference/07-ui-ux.md` | **À quoi ça ressemble** : décisions UI/UX, gabarits, composants, **navigation définitive**, studios — détail dans le design system et le canevas de maquettes Claude Design | ✅ v1.1 |
| 08 | `reference/08-plan-construction.md` | **Dans quel ordre on construit** : phases P0 à P10, lots par agent, critères de fin, chantiers hors code | 🟡 v1 (D50) |

**Code SQL** (`schema/`) : `project-cp-schema.sql` (structure), `project-cp-seed-reference.sql` et `project-cp-seed-ai-system.sql` (données initiales), `project-cp-tests.sql` (21 tests).

**Dépôt GitHub** `cabrel7/project-cp` : miroir de travail des agents — `docs/reference/` (ces documents), `db/schema-v1.2/` (le SQL, découpé par domaine), `docs/design-system/`, kit Claude Code dans `.claude/`. Correspondance détaillée : `docs/README.md` du dépôt.

**Archives** (`archive/`) : documents v1 issus de la première conversation. **Obsolètes, ne pas utiliser pour construire** ; conservés uniquement pour l'historique. Tout ce qui y reste utile a été repris dans les documents 01 à 05.

---

## 2. Règles pour éviter les confusions

1. **Une information = un seul endroit.** Les autres documents y renvoient au lieu de la recopier. Exemples : les prix sont dans 01, le comportement des crédits dans 02, les tables dans 04.
2. **Les décisions vivent dans 06.** Toute décision nouvelle ou modifiée y est ajoutée en premier, puis le document concerné est mis à jour.
3. **Ordre de priorité en cas de contradiction :**
   - 06 (décisions) > 02 (règles) > 01 (produit) > 03, 04, 05 (technique) ;
   - pour la structure des données, **le SQL fait foi** sur le document 04.
4. **Versions :** chaque document porte un numéro de version et une date en en-tête. Un changement majeur crée une nouvelle version ; l'ancienne va dans `archive/` avec un bandeau « obsolète ».
5. **Statuts** visibles : ✅ validé · 🟡 provisoire · ⏳ à venir · ❌ abandonné.
6. **Nom provisoire :** on écrit toujours `project-cp`. Le jour où le nom est choisi, on remplace partout d'un coup.
7. **Pour les agents Claude Code :**
   - lire 00 puis le document du domaine concerné avant de coder ;
   - ne jamais s'appuyer sur `archive/` ;
   - toute divergence entre le code et un document est signalée, jamais tranchée en silence.

---

## 3. Ce qui reste à produire

| Sujet | Où |
|---|---|
| Simulation des marges et prix définitifs | 01 + décision dans 06 |
| Prompts système v2, avec jeux d'évaluation | Admin / 05 |
| CGU, DPA, politique de confidentialité | nouveau dossier `legal/` |
