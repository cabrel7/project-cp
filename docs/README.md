# Documentation project-cp

Miroir, dans le dépôt, des documents du projet claude.ai **« ai infrastruture »**. Le dépôt est la copie de travail des agents ;
toute modification de fond se fait d'abord ici, puis est reportée dans le projet claude.ai (ou l'inverse), jamais les deux divergents.

## Correspondance des chemins
| Projet claude.ai | Dépôt |
|---|---|
| `reference/00-index.md` … `08-plan-construction.md` | `docs/reference/00-index.md` … `08-plan-construction.md` |
| `schema/project-cp-schema.sql`, `project-cp-seed-reference.sql`, `project-cp-seed-ai-system.sql`, `project-cp-tests.sql` | `db/schema-v1.2/` (mêmes contenus, découpés par domaine `000_…` à `960_…`, + `tests/001_smoke_tests.sql`) |
| `archive/v1-*.md` | non copiés (historique, ne pas utiliser) |
| `claude-system/v4/*` | non copiés (système global de Dylan, ne pas modifier) |
| Design system (artefact Claude Design) | `docs/design-system/` |
| Maquettes (canevas Claude Design) | `docs/maquettes/` : 43 captures PNG + sources HTML ; index `docs/maquettes.md` |

## Ordre de lecture
1. `reference/00-index.md` — index et règles de documentation.
2. Le document du domaine concerné (voir la carte dans `PROJECT_CONTEXT.md`).
3. En cas de contradiction : `06` (décisions) > `02` (règles) > `01` (produit) > `03` / `04` / `05` ; pour les données, **le SQL fait foi**.

## Fichiers
- `reference/00-index.md` — index, statut des documents
- `reference/01-specification-produit.md` — produit, publics, 6 briques, plans, grille des droits, admin
- `reference/02-regles-metier.md` — cycles de vie, crédits, MCP, agents, capacités et routage, paiements, Marketplace, erreurs
- `reference/03-architecture-technique.md` — services, migrations, bibliothèques, organisation du dépôt
- `reference/04-schema-donnees.md` — conventions, domaines, index, partitions, sécurité en base
- `reference/05-garde-fous-ia.md` — pipeline, profils, arrêts d'urgence, IA interne
- `reference/06-journal-decisions.md` — décisions D01 à D58
- `reference/07-ui-ux.md` — décisions UI, navigation définitive, studios
- `design-system/` — README (principes, couleur, typo, mouvement…), `patterns.md` (G1-G8), `contenu.md` (voix, glossaire),
  `dataviz.md`, `tokens.json` / `tokens.css`, `components/<27 composants>/README.md` + `bundle.css` (référence visuelle)
- `maquettes.md` + `maquettes/` — les 43 écrans validés (captures PNG, sources HTML, index)
- `reference/08-plan-construction.md` — plan de construction : phases P0 à P10, lots, critères de fin
