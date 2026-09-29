# CONTEXT — Ce qu'on construit exactement
<!-- Lu À LA DEMANDE par les agents. Règle : une information = un seul endroit.
     Ce fichier RÉSUME et POINTE vers docs/ ; en cas de doute, la source fait foi. -->

## Produit
Plateforme « AI Control Plane » du Groupe ELS : rendre n'importe quel logiciel compatible avec l'IA, pour tout le monde (commerçant sans compétence technique, créateur d'apps, développeur, entreprise). Un seul moteur API-first, plusieurs parcours. Marché : Afrique francophone d'abord (FCFA, Mobile Money, mobile d'abord), bilingue FR/EN, multi-devises (XAF, XOF, EUR, USD).
→ `docs/reference/01-specification-produit.md`

## Carte de la documentation
| Besoin | Où |
|---|---|
| Index et règles de documentation | `docs/reference/00-index.md` |
| Produit, publics, plans, grille des droits, admin | `docs/reference/01-specification-produit.md` |
| Comportements : cycles de vie, crédits, MCP, agents, routage, paiements, erreurs | `docs/reference/02-regles-metier.md` |
| Services, bibliothèques, migrations, organisation du dépôt | `docs/reference/03-architecture-technique.md` |
| Schéma de données, conventions, index, RLS, partitions | `docs/reference/04-schema-donnees.md` + `db/schema-v1.2/*.sql` (le SQL fait foi) |
| Garde-fous IA, IA interne (14 capacités système) | `docs/reference/05-garde-fous-ia.md` |
| Toutes les décisions datées (D01…) | `docs/reference/06-journal-decisions.md` |
| UI/UX, navigation définitive, studios | `docs/reference/07-ui-ux.md` |
| Design system (tokens, gabarits, composants, contenu, graphiques) | `docs/design-system/` |
| Maquettes validées (captures + sources) | `docs/maquettes.md` → `docs/maquettes/` |

## Les 6 briques (vocabulaire technique)
Control Plane (org → workspaces → environnements → projets, rôles, budgets, audit) · AI Runtime (LiteLLM, profils Flash/Smart/Max, capacités `ai.run`, Prompt Studio) · Action Runtime (8 chemins de connexion, **MCP Builder**, runtime MCP unique piloté par configuration, versions figées) · Garde-fous (pipeline 5 étapes) · Agent Runtime (Temporal ; agent = objectif + accès MCP/capacités + déclencheur + policy) · SDK & Marketplace.

## Terminologie (glossaire D49 — ne pas improviser)
| Mode Simple (défaut) | Mode Technique |
|---|---|
| Accès IA | Serveur MCP |
| Systèmes connectés | Connecteurs |
| Action | Outil |
| Assistants | Agents |
| Fonctions IA | Capacités |
| Activité / Exécution | Exécutions / Run |
| Rapide / Équilibré / Expert | Flash / Smart / Max |
| Clés d'accès | Clés d'API |
| À valider | Approbations |
| Mode test | Environnements |
Profils d'onboarding (D41) : « J'utilise l'IA pour mon activité », « Je crée des applications », « Je déploie l'IA dans mon entreprise ». Le profil ne donne **aucun droit** (les droits viennent du plan).

## Règles métier essentielles (détail : 02)
- Facturation : abonnement + crédits (1 cr = 1 FCFA de valeur), micro-crédits en base, réservation avant appel, grand livre immuable, budgets à toutes les échelles (alertes 70/90/100 %, refus à 100 %).
- Routage (D45-D46) : modèle fixé (Pro+) > profil capacité/agent > défaut workspace > défaut organisation > défaut du plan ; bascule dans le même profil, jamais vers plus cher ; BYOK prioritaire ; traçabilité `routing_source` / `fallback_reason`.
- MCP : validation 5 étapes avant publication ; version publiée immuable ; suppression et financier = approbation ; base de données = requêtes paramétrées validées, jamais de SQL libre, jamais de DELETE.
- Agents : limites (itérations, durée, profondeur ≤ 5), approbation modifiable, capacités accordées par version (D43).
- Capacités : visibilité privée / organisation / publique via Marketplace (D44) ; Marketplace scellée par défaut (D47).
- Clés d'API : appellent NOS capacités (SDK, API, MCP), une clé par app/outil (D42) ; jamais de clé de modèle brute (D09).

## Flows critiques
Inscription (e-mail+mdp, téléphone+OTP SMS, clé d'accès, Google, Apple) → onboarding 3 étapes par profil → tableau de bord · MCP Builder 5 étapes (Système → Connexion → Actions → Vérification → Publication) · Agent Studio 4 étapes (Objectif → Accès → Démarrage et règles → Essai) · approbation d'une exécution · consentement OAuth (Claude/ChatGPT) · Prompt Studio (version → évaluation → A/B → production).

## Design system (résumé — détail : docs/design-system)
Direction « Fusion A — Warm Tech » : fond crème `canvas`, violet d'action `primary` #5B50C8 (sombre #A69FF2), violet d'identité `brand-violet` (jamais pour du texte), corail `accent` = chaleur (jamais une erreur), ambre = crédits, statuts réservés. Plus Jakarta Sans (titres) · Geist (interface) · Geist Mono (code). Lucide. Clair + sombre conçus. Mode Simple par défaut. 8 gabarits G1-G8. Animations illustratives seulement sur accueil/auth/onboarding (D36/D38).

## Données (conventions — détail : 04)
`id bigint identity` interne + `public_id uuid default uuidv7()` exposé · `organization_id` partout + FK composites `(id, organization_id)` · RLS via `util.current_org_id()` · rôles `app_rw` / `app_auth` / `app_admin` / `app_readonly` · partitions mensuelles (runs, llm_requests, audit…) · `lock_version` · statuts en `text` + CHECK · i18n en `jsonb`.
