# db — schéma et migrations project-cp

Le SQL versionné est la source de vérité (PostgreSQL 18 + pgvector). Migrations gérées par
[dbmate](https://github.com/amacneil/dbmate) ; Drizzle ne fait que lire le schéma (`drizzle-kit pull`).

## Contenu

| Chemin | Rôle |
|---|---|
| `migrations/` | Migrations dbmate (`AAAAMMJJHHMMSS_description.sql`, blocs `-- migrate:up` / `-- migrate:down`). |
| `migrations/*_0001_baseline.sql` | Baseline : assemblage intégral de `schema-v1.2/` (000 à 960). |
| `tests/` | Tests SQL (`NNN_*.sql`) lancés par `tests/run.sh`. |
| `schema-v1.2/` | Sources d'origine de la baseline, conservées comme référence historique. Ne plus les modifier. |
| `dbmate.sh` | Enveloppe dbmate (dossier de migrations, pas de dump de schéma, attente de la base). |

## Configuration

`db/dbmate.sh` est lancé depuis la racine ; dbmate y charge `.env` (copie de `.env.example`) et lit
`DBMATE_DATABASE_URL` (connexion du rôle propriétaire `cp_owner`). Les variables déjà exportées
dans le shell l'emportent sur `.env`.

dbmate 2.36 ne lit aucun fichier `.dbmaterc` : toute la configuration passe par les options de `db/dbmate.sh`.

## Commandes (depuis la racine)

| Commande | Effet |
|---|---|
| `pnpm db:up` | Crée la base si besoin et applique les migrations en attente. |
| `pnpm db:status` | Liste les migrations appliquées / en attente. |
| `pnpm db:rollback` | Annule la dernière migration (exécute son `-- migrate:down`). |
| `pnpm db:create` | Crée la base. |
| `pnpm db:new nom_de_la_migration` | Génère un fichier de migration horodaté dans `db/migrations/`. |
| `pnpm db:test` | Lance les tests SQL (`db/tests/*.sql`) ; `bash db/tests/run.sh <base>` pour cibler une autre base. |

## La baseline n'est pas réversible

`0001_baseline` crée tout le schéma, les rôles applicatifs, les droits, la RLS et les données de référence.
Son `-- migrate:down` lève volontairement une exception : `pnpm db:rollback` échoue et la transaction est annulée.
Pour repartir de zéro : `pnpm infra:reset`, ou supprimer puis recréer la base et relancer `pnpm db:up`.

Le fichier de baseline ne se modifie jamais. Toute évolution est une nouvelle migration.

## Écrire une nouvelle migration

1. `pnpm db:new ajoute_colonne_x` puis remplir `-- migrate:up` **et** `-- migrate:down`.
2. `pnpm db:up`, puis `pnpm db:rollback`, puis `pnpm db:up` : prouve que le `down` fonctionne.
3. `squawk db/migrations/<fichier>.sql`.
4. Ajouter ou compléter un test dans `db/tests/` (isolation RLS entre deux organisations, contraintes, triggers), puis `pnpm db:test`.
5. `pnpm --filter @cp/db db:pull` : régénère le schéma TypeScript, à commiter avec la migration.

Règles de sûreté en production :

- Index sur une table existante : `CREATE INDEX CONCURRENTLY` dans un fichier `-- migrate:up transaction:false`.
- Pas de `NOT NULL` ajouté d'un coup sur une grosse table : colonne nullable, remplissage par lots, contrainte `NOT VALID`, `VALIDATE CONSTRAINT`, puis `SET NOT NULL`.
- `SET lock_timeout = '3s'` en tête des migrations qui prennent un verrou.
- Données de référence : `INSERT ... ON CONFLICT DO NOTHING / DO UPDATE` (idempotent).
- Jamais `drizzle-kit generate`, `push` ou `migrate`.

## Tests SQL

`tests/001_smoke_tests.sql` (23 contrôles, T1 à T22) : isolation RLS entre organisations, FK composites,
immutabilité (grand livre, audit, versions), verrou optimiste, partitions. Tout s'exécute dans une transaction annulée.

Limite connue : ces tests utilisent des identifiants fixes et les séquences ne sont pas annulées par `ROLLBACK`.
Ils exigent une base neuve (migrations appliquées, aucun test déjà joué). Pour rejouer : recréer la base
(`DROP DATABASE` / `CREATE DATABASE`, ou `pnpm infra:reset`) puis `pnpm db:up`.
