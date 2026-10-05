# Plan de construction par phases

> **Nom de code :** `project-cp` · **Statut :** 🟡 v1 proposée (décision D50) · Date : 29 septembre 2026
> Ce que les agents Claude Code codent, **dans quel ordre**, et **quand une phase est finie**.
> Ne répète pas les règles : il renvoie à 01 (produit), 02 (règles), 03 (architecture), 04 (données), 05 (garde-fous), 07 (UI) et au design system.

---

## 1. Principes

1. **Tranches verticales.** Chaque phase livre quelque chose qui marche de bout en bout (base → API → écran → tests), démontrable, derrière un feature flag si besoin. Jamais « tout le back puis tout le front ».
2. **Le schéma existe déjà.** Le SQL v1.2 (183 tables) couvre tout le produit : les phases **activent** des tables existantes ; une migration nouvelle est l'exception, justifiée par l'architect.
3. **Ordre = dépendances réelles**, pas l'ordre commercial de 01 §10. Le socle IA (gateway, capacités internes) vient avant le MCP Builder, qui en a besoin pour transformer une API en outils. L'ouverture aux clients suit ensuite l'ordre de 01 §10 grâce aux feature flags.
4. **Une phase est finie quand ses critères de fin sont prouvés** (sorties de tests, captures, démo enregistrée), pas quand le code est écrit.
5. **Chaque lot passe par `/feature`** (architect → database → backend → frontend → tester → reviewer, + ux-reviewer / e2e-tester). Taille : S ≤ 1 session, M ≤ 3, L = à découper par l'architect.
6. **L'admin se construit au fil de l'eau** : chaque phase livre les écrans d'administration de ce qu'elle crée.
7. **Rien d'irréversible sans validation de Dylan** : nouvelle table, route publique, changement de prix, décision (→ 06 d'abord).

---

## 2. Vue d'ensemble

```
 Chantiers hors code (en parallèle) ─────────────────────────────────────────────────────────────
  A. Marges et prix ───────────────┐ (avant fin P3)
  B. Prompts v2 + évaluations ─────┼──────────────┐ (avant fin P4)
  C. POC OAuth 2.1 (D26) ──────────┼───┐          │ (avant P5)
  D. CGU / DPA / confidentialité ──┼───┼──────────┼───────────────┐ (avant bêta publique)
                                   │   │          │               │
 P0 Socle ─► P1 Design system ─────┼───┼──────────┼───────────────┼─────────────────────────────
     │        (en parallèle de P2) │   │          │               │
     └────► P2 Identité et organisations ─► P3 Crédits et plans ─► P4 Gateway IA et garde-fous
                                                                      │
                                   P5 MCP Builder ◄───────────────────┘
                                      │
                               ══ BÊTA PRIVÉE ══  (clients pilotes, dont Kòmerce — D03)
                                      │
                                   P6 SDK et capacités ─► P7 Agent Studio ─► P8 Exploitation et lancement
                                                                                   │
                                                                       ══ BÊTA PUBLIQUE ══
                                                                                   │
                                                                     P9 Entreprise ─► P10 Marketplace
```

| Phase | Nom | Dépend de | Ouverture (01 §10) |
|---|---|---|---|
| P0 | Socle du dépôt et de la base | — | — |
| P1 | Design system en code (`packages/ui`) | P0 | — |
| P2 | Identité, organisations, onboarding | P0 (P1 pour les écrans) | Fondations |
| P3 | Crédits, plans, droits, paiements | P2 | Fondations |
| P4 | Gateway IA, garde-fous, IA interne, chat | P3 | Fondations |
| P5 | Connecteurs, MCP Builder, runtime MCP, OAuth | P4 | MCP Builder |
| P6 | SDK, capacités `ai.run`, clés d'accès, Prompt Studio | P5 | SDK + capacités |
| P7 | Agent Studio | P6 | Agent Studio |
| P8 | Exploitation, sécurité, performance, lancement | P7 | — |
| P9 | Entreprise | P8 | Entreprise |
| P10 | Marketplace | P8 | Marketplace |

---

## 3. Définition de « terminé » (toute tâche, toute phase)

- [ ] Code conforme aux invariants de `CLAUDE.md` (hook de garde sans violation).
- [ ] Tests écrits **et exécutés**, sortie brute jointe : unitaires, intégration sous RLS avec **deux organisations**, et e2e pour tout parcours d'écran.
- [ ] Écrans : gabarit du design system, clair + sombre + mobile, FR + EN, mode Simple + Technique, tous les états (07, `cp-ui-ux`).
- [ ] Codes d'erreur du catalogue, droits vérifiés dans l'ordre flag → plan → surcharge → budget.
- [ ] Spec OpenAPI, client front et SDK régénérés si une route change.
- [ ] Revue `reviewer` sans CRITICAL/MAJOR ouvert ; `ux-reviewer` pour tout écran.
- [ ] `PROJECT_STATE.md` mis à jour ; décision nouvelle ajoutée à 06.

---

## 4. Les phases

### P0 — Socle du dépôt et de la base
**Objectif :** un monorepo qui compile, teste, migre et se lance en local et en session cloud, avec la base v1.2 en migration de base.

| Lot | Contenu | Agents | Taille |
|---|---|---|---|
| P0.1 | Monorepo : pnpm + turborepo, `tsconfig.base`, Biome, lefthook, commits conventionnels, `catalog:` des versions, squelettes des 7 apps et 7 paquets (03 §5) | devops | M |
| P0.2 | `infra/docker-compose.dev.yml` : PostgreSQL 18 + pgvector, Redis, SeaweedFS (S3), Mailpit, LiteLLM (config vide), Temporal (dev) ; `.env.example` | devops | M |
| P0.3 | **Baseline dbmate** : `db/schema-v1.2` → `db/migrations/…_0001_baseline.sql` (structure) + migrations de données idempotentes (950, 960) ; tests `001_smoke_tests.sql` → `db/tests/` + `run.sh` | database | M |
| P0.4 | `packages/db` : `drizzle-kit pull`, client postgres.js, trois pools (`app_rw`, `app_auth`, `app_admin`), `withOrgContext`, helpers `public_id` | database, backend | M |
| P0.5 | `packages/shared` : codes d'erreur (enum synchronisé avec `platform.error_codes` + test d'égalité), schémas zod de base (UUID, pagination, erreur), constantes du glossaire | backend | S |
| P0.6 | `apps/api` minimal : `env.ts`, pino, request-id, OTel, `onError` au format unique, `/health`, `/openapi.json`, `/docs` | backend | S |
| P0.7 | CI GitHub Actions : install → biome → typecheck → tests → base neuve + migrations + tests SQL → `pull` identique → squawk → build | devops | M |

**Critères de fin**
- `pnpm install && pnpm turbo run build typecheck test` vert en local et en CI.
- `dbmate up` sur base neuve puis `db/tests/run.sh` : **23 contrôles OK** (T1-T22) ; `dbmate rollback` de la baseline refusé ou documenté (baseline non réversible par nature, dit explicitement).
- CI rouge si `drizzle-kit pull` diffère du commit.
- `GET /health` 200 ; une erreur provoquée renvoie le format unique avec `request_id`.
- Session cloud : `/setup` prépare tout, hooks actifs (une écriture violant un invariant est bloquée).

---

### P1 — Design system en code (`packages/ui`) — *chantier « Thème Nuxt UI »*
**Objectif :** que les écrans codés ressemblent **exactement** aux maquettes, sans que chaque agent réinvente un composant.

| Lot | Contenu | Agents | Taille |
|---|---|---|---|
| P1.0 | **Spike D27** (≤ 1 session) : 3 composants témoins (Button, DataTable, Stepper) en Nuxt UI vs shadcn-vue, clair/sombre ; verdict consigné dans 06 | frontend, ux-reviewer | S |
| P1.1 | Thème : `tokens.json` → `tokens.css` → `@theme` Tailwind v4 → `app.config.ts` Nuxt UI (couleurs, rayons, tailles de contrôle, typo, focus-ring) ; polices et icônes Lucide | frontend | M |
| P1.2 | Les 27 composants (`Cp*` ou Nuxt UI configurés) selon `docs/design-system/components/*/README.md`, avec états, a11y, clair/sombre | frontend | L (3 lots) |
| P1.3 | `AppShell` + navigations **définitives** client et admin (07), `ModeToggle`, sélecteur org/workspace, barre du haut, tiroir mobile | frontend | M |
| P1.4 | Gabarits G1-G8 en layouts/composants de page réutilisables | frontend | M |
| P1.5 | Catalogue vivant (pages Nuxt de démonstration, D57) + régression visuelle Playwright des composants et gabarits (clair, sombre, mobile) comparée aux maquettes | e2e-tester, ux-reviewer | M |

**Critères de fin**
- Zéro couleur/taille en dur dans `apps/*` (règle du guard) ; tous les composants du design system disponibles.
- Page de démonstration par gabarit ; captures de référence validées par Dylan contre le canevas de maquettes.
- Contraste AA vérifié automatiquement (axe-core dans Playwright) dans les deux thèmes.
- `ux-reviewer` ≥ 8/10 sur chaque gabarit.

---

### P2 — Identité, organisations, onboarding
**Objectif :** un utilisateur crée son compte, son organisation, invite son équipe et arrive sur un tableau de bord vide mais juste.

| Lot | Contenu | Agents | Taille |
|---|---|---|---|
| P2.1 | Inscription/connexion e-mail + mot de passe, sessions, déconnexion partout, mot de passe oublié | backend, frontend | M |
| P2.2 | Téléphone + OTP SMS (fournisseur SMS derrière une interface, simulé en dev), règle « un compte gratuit par numéro vérifié » | backend, frontend | M |
| P2.3 | Google + Apple (arctic), clés d'accès (WebAuthn), 2FA TOTP + codes de secours | backend, frontend | M |
| P2.4 | Organisations, workspaces, environnements (dont sandbox), rôles système, invitations, transfert d'Owner | backend, frontend | M |
| P2.5 | Onboarding 3 étapes × 3 profils (D41), animations d'auth/onboarding (D36/D38) | frontend | M |
| P2.6 | Admin : connexion équipe interne (session courte + minuteur), liste et fiche clients, audit | backend, frontend | M |
| P2.7 | Chantier C en code : **POC OAuth 2.1** (`apps/auth`, oidc-provider) jusqu'à un client MCP de test | backend | M |
| P2.8 | Stockage des fichiers (D52) : client S3 par backend (`storage.backends`, identifiants Infisical), envoi / liens signés / suppression, `backend_id` enregistré ; premier usage : avatars | backend | M |

**Critères de fin**
- E2E : les 3 parcours d'onboarding complets, mobile et desktop ; OTP expiré / trop d'essais ; 2FA.
- Isolation prouvée : l'utilisateur de l'org A ne voit rien de B (API + écran).
- Écrans conformes aux maquettes de la page 1 (auth) et 2 (onboarding).
- Verdict du POC OAuth consigné dans 06 (D26 ✅ ou alternative).

---

### P3 — Crédits, plans, droits, paiements
**Objectif :** chaque action coûteuse peut être autorisée, réservée, débitée, remboursée et facturée — avant le premier appel IA.

| Lot | Contenu | Agents | Taille |
|---|---|---|---|
| P3.1 | `packages/billing` : portefeuilles, lots FIFO, grand livre, réservation / régularisation / remboursement, découvert technique (fonctions transactionnelles + tests de concurrence) | database, backend, tester | L |
| P3.2 | Chaîne de droits : feature flags → droits de plan (`billing.features`) → surcharges → budgets/crédits ; middleware `featureGate`, composant `PlanGate` | backend, frontend | M |
| P3.3 | Budgets multi-échelles (Redis temps réel + consolidation), alertes 70/90/100 % | backend | M |
| P3.4 | Abonnements (Free → Starter/Pro/Business + BYOK), changement de plan, prorata, `past_due` → grâce → Free | backend | M |
| P3.5 | Paiement Mobile Money : **un agrégateur** d'abord (interface commune), idempotence, webhooks signés et dédupliqués ; recharges de crédits | backend | M |
| P3.6 | Factures numérotées sans trou + PDF ; écrans « Crédits et facturation », « Budgets », `CreditMeter` | backend, frontend | M |
| P3.7 | Admin : Finance, Tarification et plans (prix datés), gestes commerciaux audités | backend, frontend | M |

**Prérequis :** chantier A (marges et prix) **tranché** — sinon les prix provisoires D20 restent en paramètres et la phase se termine quand même, marquée « prix 🟡 ».
**Critères de fin**
- 100 réservations concurrentes sur un solde juste : jamais de solde négatif hors découvert (test).
- Grand livre équilibré au µcr près sur un scénario complet (achat → consommation → remboursement → facture).
- Paiement de test bout en bout chez l'agrégateur (sandbox), webhook rejoué deux fois = un seul crédit.
- Chaque refus renvoie le bon code (`PLATFORM_FEATURE_DISABLED` / `…_NOT_AVAILABLE` / `BILLING_*`).

---

### P4 — Gateway IA, garde-fous, IA interne, chat
**Objectif :** appeler un modèle proprement : routé, protégé, tracé, facturé. La plateforme utilise elle-même ses 14 capacités internes.

| Lot | Contenu | Agents | Taille |
|---|---|---|---|
| P4.1 | LiteLLM en service, catalogue fournisseurs/modèles/prix datés, taux de change ; admin Fournisseurs | devops, backend | M |
| P4.2 | Exécution d'une capacité : résolution D45, bascule D46, BYOK, réservation, traçabilité `routing_source` / `fallback_reason` | backend, tester | L |
| P4.3 | `packages/guard` : pipeline 5 étapes, profils, cascade, cache de verdicts, journal sans contenu brut ; détecteurs règles d'abord, modèles locaux ONNX ensuite | backend, tester | L |
| P4.4 | Arrêts d'urgence (Redis, toutes portées) + bouton admin permanent | backend, frontend | M |
| P4.5 | Admin « IA de la plateforme » : capacités internes, versions, évaluations, mise en production **bloquée sous le seuil**, garde-fous, modèles autorisés, coûts | backend, frontend | L |
| P4.6 | Chat du workspace (G6) avec `system.chat.workspace_assistant`, streaming SSE, coût affiché | backend, frontend | M |
| P4.7 | Copilote d'onboarding et explication d'erreurs branchés sur leurs capacités | frontend | S |

**Prérequis :** chantier B — prompts v2 et jeux d'évaluation des 14 capacités internes.
**Critères de fin**
- Les 14 capacités internes **en production** avec un score d'évaluation ≥ seuil (preuve : rapport d'évaluation).
- Tests MSW : jamais de bascule vers un profil plus cher ; modèle fixé indisponible → profil ; `fail` en Technique.
- Jeu d'attaques de référence (injection directe/indirecte, secrets en sortie) : blocages attendus, faux positifs mesurés en mode Observation.
- Arrêt d'urgence global effectif en < 2 s sur un chat en cours.
- Chaque appel visible dans Activité avec « Modèle utilisé : X (profil …) » et son coût.

---

### P5 — Connecteurs, MCP Builder, runtime MCP, OAuth
**Objectif :** un commerçant connecte son logiciel et l'utilise depuis Claude ou ChatGPT sans écrire de code. **C'est la première valeur livrée.**

| Lot | Contenu | Agents | Taille |
|---|---|---|---|
| P5.1 | `packages/connectors` : exécuteur HTTP/OpenAPI (import, SSRF, timeouts, cockatiel), coffre Infisical pour les identifiants | backend | L |
| P5.2 | Connecteur base de données : requêtes paramétrées générées (`system.mcp.sql_templates`), analyse syntaxique, lecture seule par défaut, écriture 1 ligne + approbation | backend, tester | L |
| P5.3 | Deux connecteurs prêts à l'emploi, dont **Kòmerce** (banc d'essai, D03) | backend | M |
| P5.4 | MCP Builder (G3, 5 étapes, maquettes page 4) : Système → Connexion → Actions/Outils → Vérification (validation 5 étapes) → Publication (version figée) | backend, frontend | L |
| P5.5 | `apps/mcp-runtime` : séquence complète d'un `tools/call` (02 §4.2), cache Redis de la version active, audit + débit | backend, tester | L |
| P5.6 | OAuth 2.1 en production (suite du POC) + écran de consentement G8 ; jetons statiques pour Cursor / Claude Desktop | backend, frontend | M |
| P5.7 | Fiabilité : santé 5/15 min, disjoncteur, statut des connecteurs, notifications ; admin « MCP et connecteurs » | backend, frontend | M |

**Critères de fin**
- Démo enregistrée : un serveur Kòmerce créé en mode Simple, publié, **utilisé depuis Claude et depuis ChatGPT** (OAuth), une action d'écriture approuvée depuis le téléphone.
- Connecteur SQL : DELETE, DDL, requêtes multiples, superutilisateur, > 1 ligne → tous refusés (tests).
- Surcoût plateforme d'un `tools/call` < 50 ms p95 (hors système client).
- Version publiée non modifiable (test) ; outil en panne sans impact sur les autres (test).

**═ Porte BÊTA PRIVÉE ═** : P0-P5 terminées, sauvegardes restaurées une fois, 3 à 10 clients pilotes invités (`signup.mode = invite_only`).

---

### P6 — SDK, capacités `ai.run`, clés d'accès, Prompt Studio
**Objectif :** un créateur d'apps ajoute l'IA à son application avec une clé et une capacité, sans gérer l'intégration (D41, D42).

| Lot | Contenu | Agents | Taille |
|---|---|---|---|
| P6.1 | Clés d'accès (une par app, environnement, portées, IP/origines), `SecretField` | backend, frontend | M |
| P6.2 | API publique `POST /v1/capabilities/{slug}/run` (synchrone + SSE), idempotence, rate limit | backend | M |
| P6.3 | Capacités client : création, visibilité (D44), versions, mise en production par environnement | backend, frontend | M |
| P6.4 | Prompt Studio (maquettes page 5) : éditeur, essai avec coût, évaluations, A/B, retour arrière (selon plan) | backend, frontend | L |
| P6.5 | SDK TypeScript (`packages/sdk-ts`) généré + surcouche `ai.run`, exemples ; webhooks sortants signés | backend | M |
| P6.6 | Mode test (sandbox) complet : portefeuille test, outils simulés ; documentation développeur (`@nuxt/content`) | backend, frontend | M |

**Critères de fin**
- Une app exemple (Nuxt ou Node) appelle une capacité via le SDK en < 10 lignes ; parcours documenté testé en e2e.
- Aucun endpoint compatible OpenAI (guard + test d'API).
- Capacité privée invisible d'un autre workspace ; organisation → visible partout (tests).

---

### P7 — Agent Studio
**Objectif :** un assistant qui travaille seul, dans des limites claires, et demande la permission avant d'agir.

| Lot | Contenu | Agents | Taille |
|---|---|---|---|
| P7.1 | `apps/agent-worker` : workflow Temporal, activités, limites, annulation, rejeu | backend, tester | L |
| P7.2 | Accès granulaires (serveur, version épinglée, outil, capacité — D43) et approbations modifiables (mobile d'abord) | backend, frontend | L |
| P7.3 | Déclencheurs : manuel, planifié, webhook, événement (seuil derrière flag) ; horaires autorisés | backend | M |
| P7.4 | Agent Studio 4 étapes + fiche agent + page d'exécution en direct (maquettes page 5), `system.agent.config_from_nl` | frontend, backend | L |
| P7.5 | Mémoire (portée, rétention selon plan) ; admin « Agents » | backend, frontend | M |

**Critères de fin**
- Démo : « relancer les impayés chaque lundi » créé en français, essai sans effet, activation, approbation corrigée depuis le téléphone, run tracé et facturé.
- Tests temps sauté : approbation expirée → annulé ; profondeur 6 refusée ; hors horaires refusé ; aucun débit pendant l'attente.

---

### P8 — Exploitation, sécurité, performance, lancement
**Objectif :** pouvoir ouvrir au public sans crainte.

| Lot | Contenu | Agents | Taille |
|---|---|---|---|
| P8.1 | Production sur VPS-4 : compose prod (dont SeaweedFS), Nginx/TLS, Infisical, sauvegardes chiffrées hors site (base **et** fichiers) + restauration testée | devops | L |
| P8.2 | Observabilité : tableaux Grafana, alertes, GlitchTip, Langfuse ; page de statut et incidents | devops, backend | M |
| P8.3 | Audit de sécurité complet (`/audit-rules`, `cp-security`), tests d'intrusion ciblés (isolation, SSRF, OAuth, injection) | reviewer | L |
| P8.4 | Performance : budgets de latence tenus, Lighthouse mobile 4G, charge de base (k6) | backend, frontend | M |
| P8.5 | Admin restant : Pilotage, Support, Conformité, Déploiement progressif, Contenu et traductions | backend, frontend | L |
| P8.7 | Admin « Stockage » (D52) : backends, espace utilisé et alertes, bascule du backend actif, migration des fichiers en tâche de fond (`apps/worker`, reprenable, vérification sha256) | backend, frontend | M |
| P8.6 | Chantier D en ligne : CGU, DPA, confidentialité, consentements versionnés | frontend | S |

**Critères de fin**
- Restauration complète réussie sur une machine vierge (chronométrée).
- Zéro CRITICAL/MAJOR de sécurité ouvert ; budgets de latence (`cp-performance`) tenus.
- Documents juridiques publiés et acceptés à l'inscription.

**═ Porte BÊTA PUBLIQUE ═** : `signup.mode = open`, flags ouverts selon 01 §10.

---

### P9 — Entreprise · P10 — Marketplace
Planifiées en détail à la sortie de P8 (retours de la bêta d'abord).
- **P9** : SSO (SAML/OIDC), rôles personnalisés, équipes, circuits d'approbation, export de l'audit, choix de région.
- **P10** : publication, niveaux (Community → Official), capacités scellées (D47), paiements créateurs, modération.

---

## 5. Chantiers hors code

| Chantier | Livrable | Où | Nécessaire avant |
|---|---|---|---|
| **A. Marges et prix** | Simulation (coûts fournisseurs, infra, taux, coefficients, crédits inclus, packs) → prix définitifs | 01 + décision 06 + migration de données | fin de P3 |
| **B. Prompts v2 + évaluations** | 14 prompts v2 (profils D41, glossaire, sorties JSON strictes) + jeux d'évaluation et seuils | 05 + migration de données (960) | fin de P4 |
| **C. POC OAuth 2.1** | Verdict D26 | 06 | P5 |
| **D. Juridique** | CGU, DPA, politique de confidentialité, mentions sur les crédits | dossier `legal/` | bêta publique |
| **E. Nom définitif** | Nom, domaine, logo → `brand.name` | 06 (D21) | publication du SDK (P6) |

---

## 6. Comment lancer le travail dans Claude Code

- Une session = un lot (ou une partie d'un lot L). Commande : `/feature P2.1 — <intitulé du lot>` ; l'architect lit ce document pour le périmètre et les critères.
- En fin de lot : `PROJECT_STATE.md` à jour (lot en ✅ Done, suivant en 🔄 Active).
- En fin de phase : `/audit-rules`, puis démonstration à Dylan avec les preuves des critères de fin ; la phase n'est cochée qu'après validation.
- Tout écart au plan (ordre, périmètre) est proposé, validé, puis inscrit dans 06 avant d'être appliqué.
