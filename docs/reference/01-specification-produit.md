# Spécification produit — v2 consolidée

> **Nom provisoire :** `project-cp` (nom de code). Le nom définitif sera choisi plus tard ; il est centralisé dans le paramètre `brand.name`.
> **Statut :** référence validée — remplace « Description complète du projet v1 » (archivée). Index de tous les documents : `00-index.md`.
> **Date :** 29 septembre 2026 · **Porteur :** Groupe ELS (SARL, Cameroun — légalisation fin 2026)

---

## 1. Mission

**Rendre n'importe quel système compatible avec l'IA, simplement et en sécurité, pour n'importe qui.**

- Sans compte chez les fournisseurs de modèles.
- Sans carte bancaire internationale : paiement en Mobile Money.
- Sans comprendre les notions techniques (API, tokens, MCP).
- Bilingue français / anglais et multi-devises **dès le départ**.

On ne vend **pas** d'accès aux modèles ni de clés. On vend **l'abstraction de toute la complexité** : intégration, optimisation, contrôle de la consommation, observabilité, sécurité, gouvernance.

**Promesse :** *« Connecte ton système une fois. L'IA peut l'utiliser. Tu contrôles tout. »*

Trois niveaux d'abstraction empilés :

| Niveau | L'utilisateur n'a pas besoin de… | Géré par |
|---|---|---|
| 1 | savoir ce qu'est une API | Connecteurs + MCP Builder |
| 2 | avoir un compte OpenAI / Anthropic | AI Runtime (gateway) |
| 3 | comprendre comment marche un agent | Agent Studio |

---

## 2. Publics — un seul moteur, plusieurs parcours

| Public | Ce qu'il fait | Parcours |
|---|---|---|
| **Non-dev** (commerçant, PDG, PME) | Connecte son CRM, son ERP, Google Sheets en quelques clics ; parle à son système ; crée des agents en français | Assistant guidé, zéro terme technique |
| **Vibe coder** | Colle quelques lignes de SDK générées pour lui | Snippets générés, MCP Builder visuel |
| **Développeur** | SDK, CLI, API, BYOK, environnements, contrôle total | Interface technique complète |
| **Entreprise** | Connecte ses systèmes internes, permissions par rôle / équipe, audit, SSO | Configuration guidée + support |

Le moteur est construit **API-first** : chaque fonction existe d'abord comme API, chaque public a son interface par-dessus. Le **MCP Builder s'adresse à tout le monde dès le départ** (ex. : un PDG qui connecte son CRM pour qu'un agent fasse les relances).

**Kòmerce** sert de **banc d'essai** (pas de cible exclusive) : identité multi-tenant (chaque marchand ne voit que ses données), connecteur base de données sur Laravel, webhooks entrants, agent de relance avec approbation, Mobile Money, mode hors-ligne et erreurs réseau.

---

## 3. Les 6 briques

### 3.1 Control Plane (le socle, invisible)
- **Hiérarchie :** organisation → workspaces → environnements (dev, staging, prod, sandbox) → projets.
- **Accès :** rôles système (Owner, Admin, Developer, Operator, Viewer), rôles personnalisés (Enterprise), équipes / départements (Business+).
- **Argent :** portefeuilles de crédits (LLM, infra, test), grand livre immuable, budgets à toute échelle (organisation, workspace, environnement, projet, équipe, agent, clé API, utilisateur final).
- **Sécurité :** policies (qui peut faire quoi, approbations, horaires, montants), coffre de secrets (Infisical) — un secret n'est jamais visible, même par son propriétaire.
- **Traçabilité :** chaque coût remonte organisation → workspace → environnement → projet → run → requête fournisseur / appel d'outil. Audit immuable.

### 3.2 AI Runtime (accès aux modèles)
- **Gateway LiteLLM** avec nos comptes fournisseurs ; plusieurs sources pour un même modèle (Anthropic direct, Bedrock, Vertex ; OpenAI, Azure…) → répartition de charge et bascule, **sans rotation de comptes** (interdite par les conditions des fournisseurs).
- **Profils Flash / Smart / Max** = intentions (coût-vitesse / équilibre / qualité). Le routeur choisit le modèle réel.
- **`ai.run("capacité")`** : le développeur appelle une capacité métier (`invoice.extract`, `support.reply`), pas un modèle. Les **agents** peuvent aussi appeler des capacités comme des outils.
- **Choix du modèle** : modèle fixé (Pro et plus) > profil de la capacité ou de l'agent > défaut du workspace / de l'organisation > défaut du plan ; bascule dans le même profil en cas de panne. Détail : `02-regles-metier.md` § 5 bis.
- **Prompt Studio :** prompts versionnés, mise en production par environnement, test A/B, évaluations.
- **Optimisation :** compression du contexte, cache sémantique, affichage des tokens économisés.
- **Fonctions** (activation échelonnée par feature flags) : texte, outils, JSON structuré et embeddings d'abord ; vision et transcription audio ; puis synthèse vocale, images, vidéo. Le schéma gère dès maintenant toutes les unités de facturation (tokens, images, secondes, caractères, pages).
- **Pas d'endpoint brut compatible OpenAI.** L'utilisateur passe par le SDK et nos capacités ; c'est l'usage « power products and services » autorisé par les fournisseurs.

### 3.3 Action Runtime (connecteurs + MCP)
- **8 chemins de connexion :** OpenAPI, API sans doc (mode guidé en français), base de données, Google Workspace, SaaS connus, fichiers, webhooks entrants, bridge local. Plus **Bring your own MCP** (MCP externes branchés derrière nos règles).
- **Sémantisation :** l'IA transforme des opérations brutes en outils compréhensibles (`create_order`, pas `post_orders`) avec niveau de risque et effet (lecture, écriture, suppression, financier, message externe).
- **Runtime MCP unique, multi-tenant, piloté par la configuration :** aucun code généré, aucun déploiement par client. Publier = créer une **version figée** ; rollback = changer de version active.
- **Tool routing :** l'agent ne reçoit que les outils pertinents (embeddings des outils).
- **Authentification des clients MCP :** OAuth 2.1 (Claude, ChatGPT — requis dès la V1), jeton statique (Cursor, Desktop), clé API (SDK).
- **Protections :** validation des paramètres, approbations, circuit breaker, relances, contrôles de santé.
- **Bases de données :** jamais de SQL libre, requêtes paramétrées validées par l'utilisateur, lecture seule par défaut, jamais de DELETE ni de DDL.

### 3.3 bis Garde-fous IA
Pipeline en 5 étapes (entrée, contexte, action, sortie, coûts), du contrôle le moins cher au plus cher, actions toujours soumises à des contrôles déterministes, profils Standard / Strict (automatique dès qu'un run peut écrire, supprimer, payer ou envoyer) / Interne / Observation, arrêts d'urgence. Détail : `05-garde-fous-ia.md`.

### 3.4 Agent Runtime
- **Un agent = objectif + accès MCP + déclencheur + policy.**
- Déclencheurs : planifié, webhook, chat, seuil, manuel, événement.
- Configuration : profil de modèle, itérations, durées, mémoire court / long terme, approbations, budgets par exécution et par mois, horaires autorisés, une exécution à la fois par défaut.
- **Versions immuables** : chaque exécution référence la configuration exacte utilisée.
- Moteur : Temporal (reprise après panne, attente d'approbation sans consommer).

### 3.5 SDK et outils développeur
- SDK officiels TypeScript, Python, PHP, Dart ; autres langages générés depuis la spec OpenAPI (Stainless ou Speakeasy).
- CLI (connexion par device flow), webhooks sortants signés, idempotence, mode test.
- **Metering par utilisateur final** : le développeur peut suivre et limiter la consommation de chacun de ses propres clients.

### 3.6 Marketplace
- Types : serveurs MCP, modèles d'agents, prompts, **capacités**, bundles ; livraison **scellée** (prompt protégé, défaut) ou copie modifiable.
- Niveaux : Community, Verified, Official, Premium. Partage **70 % créateur / 30 % plateforme**, versé en Mobile Money (seuil 5 000 F).
- L'acheteur utilise **ses propres identifiants** ; une installation crée une copie indépendante.

---

## 4. Les 4 façons d'accéder à l'IA

| Mode | Description | Ce qui est facturé |
|---|---|---|
| **A** | Notre MCP branché sur **son** Claude / ChatGPT / Cursor | Crédits infra (appels d'outils) |
| **B** | Chat sur la plateforme | Crédits LLM + infra |
| **C** | Agents qui tournent chez nous | Crédits LLM + infra |
| **D** | SDK dans son application (capacités `ai.run`) | Crédits LLM + infra, ou infra seule en BYOK |

---

## 5. Exemple de bout en bout — le PDG et ses relances CRM

1. Il choisit « HubSpot » (ou colle l'URL de son CRM) et autorise l'accès → identifiants dans le coffre.
2. La plateforme génère les outils ; `send_email` est marqué « à approuver ».
3. Il publie → version de configuration figée (pas de déploiement).
4. Il crée l'agent « Relances » : objectif en français, déclencheur « lundi 8 h », budget 500 crédits par exécution.
5. Lundi 8 h : le moteur d'agents lance le run → le routeur choisit le modèle (profil Smart) → l'agent lit les impayés, prépare les emails → le PDG reçoit une demande d'approbation → les emails partent → tout est audité et débité.
6. Tableau de bord : le run, son coût, les emails envoyés, le budget restant.

---

## 6. Modèle économique

### 6.1 Principes
- **Abonnement** = accès à la plateforme. **Crédits** = consommation.
- **1 crédit = 1 FCFA de valeur** de consommation. C'est un **prépaiement de services**, ni une monnaie ni un moyen de paiement transférable.
- Le **Run** est une métrique d'affichage ; le **crédit** est l'unité réellement débitée ; les tokens sont le détail technique.
- **Débit :** `crédits = coût fournisseur (USD) × taux USD→XAF du jour × coefficient du plan`. Prix des modèles en base, datés, jamais dans le code ; chaque débit garde le taux et le coefficient appliqués.
- **Crédits infra** pour ce qui ne passe pas par nos modèles (BYOK, mode A, agents, stockage, bridge).
- **BYOK** disponible sur tous les plans payants (variantes « infra seule » moins chères).
- **Coefficient** : doit couvrir frais d'agrégateur (~2–3,5 %), change, runs remboursés, coût du Free, TVA (19,25 % au Cameroun, à confirmer ; affichage HT/TTC à décider). Repère concurrent : Rodium prend 5,5 %.

### 6.2 Plans (prix provisoires, par mois)

| | Free | Starter | Pro | **Business** | Enterprise |
|---|---|---|---|---|---|
| Prix XAF / XOF | 0 | 4 900 | 19 900 | **49 900** | sur devis |
| Prix EUR (indicatif) | 0 | 7,49 € | 29,99 € | 75,99 € | sur devis |
| Crédits LLM inclus | 300 (modèles éco payants, plafond strict) | 2 500 | 12 000 | 30 000 | négociés |
| Crédits infra inclus | 200 | 1 000 | 5 000 | 15 000 | négociés |
| Coefficient LLM | ×1,3 | ×1,3 | ×1,2 | ×1,15 | négocié |
| Variante BYOK | — | 2 900 | 12 900 | 34 900 | incluse |
| Crédits infra BYOK | — | 2 000 | 10 000 | 25 000 | négociés |

Offre Free protégée : un compte par numéro vérifié par OTP, rate limits, détection des multi-comptes.

**Recharges** (remise plafonnée à -15 % pour ne jamais vendre à perte) : 1 000 cr → 1 000 F · 5 000 → 4 750 F · 20 000 → 18 000 F · 100 000 → 85 000 F.

**Crédits infra (provisoire)** : requête gateway BYOK 0,1 cr · appel d'outil MCP 0,5 cr · exécution d'agent 2 cr (+0,2 cr / étape au-delà de 10) · déclenchement 0,1 cr · attente d'approbation gratuite · mémoire long terme 50 cr/Go/mois · stockage fichiers 100 cr/Go/mois au-delà du quota · bridge actif 500 cr/mois.

> À faire avant lancement : simulation chiffrée des marges par plan avec les vrais prix des modèles.

### 6.3 Grille des fonctionnalités par plan (validée)

| Fonctionnalité | Free | Starter | Pro | Business | Enterprise |
|---|---|---|---|---|---|
| Workspaces | 1 | 3 | illimités | illimités | illimités |
| Membres | 1 | 3 | 10 | 30 | illimités |
| Environnements | 1 | 2 | 3 | 5 | personnalisés |
| Rôles | Owner | standards | standards | standards + équipes | personnalisés |
| Serveurs MCP | 1 | 5 | illimités | illimités | illimités |
| Outils par serveur | 10 | 30 | 100 | 100 | personnalisé |
| Connecteurs prêts à l'emploi | 2 | ✓ | ✓ | ✓ | ✓ |
| OpenAPI / API sans doc | ✗ | ✓ | ✓ | ✓ | ✓ |
| Base de données | ✗ | lecture seule | lecture + écriture contrôlée | idem | idem |
| Bridge local | ✗ | ✗ | ✓ | ✓ | ✓ |
| Bring your own MCP | ✗ | ✗ | ✓ | ✓ | ✓ |
| Connexion Claude / ChatGPT (OAuth) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Types d'agents | chat | + manuel, planifiés | tous | tous | tous |
| Nombre d'agents | 1 | 3 | illimités | illimités | illimités |
| Exécutions simultanées | 1 | 2 | 10 | 25 | personnalisé |
| Mémoire long terme | ✗ | 30 j | 90 j | 180 j | personnalisée |
| Approbations | ✓ | ✓ | + délégation | + circuits | + circuits |
| Profils de modèles | Flash | Flash + Smart | + Max | + Max | tous |
| Choix d'un modèle précis | ✗ | ✗ | ✓ | ✓ | ✓ |
| BYOK | ✗ | ✓ | ✓ | ✓ | ✓ |
| Prompt Studio | ✗ | versions | + A/B | + évaluations | + évaluations |
| Optimisation et cache | ✗ | ✓ | ✓ | ✓ | ✓ |
| SDK et CLI | tests | ✓ | ✓ | ✓ | ✓ |
| Webhooks sortants | ✗ | ✓ | ✓ | ✓ | ✓ |
| Rate limit API (req/min) | 30 | 120 | 600 | 1 500 | personnalisé |
| Budgets | alerte seule | ✓ | par environnement | par équipe | par équipe |
| Rétention des logs | 7 j | 30 j | 90 j | 180 j | 365 j + |
| Export de l'audit | ✗ | ✗ | ✓ | ✓ | ✓ |
| SSO | ✗ | ✗ | ✗ | social (Google / Microsoft) | SAML / OIDC |
| Domaine personnalisé | ✗ | ✗ | ✓ | ✓ | ✓ |
| Région de données au choix | ✗ | ✗ | ✗ | ✗ | ✓ |
| Marketplace : installer | gratuit | ✓ | ✓ | ✓ | + catalogue privé |
| Marketplace : publier | ✗ | Community | + Verified, Premium | idem | idem |
| Support | documentation | email 48 h | email 24 h + chat | email 12 h + chat | dédié + SLA |

Cette grille est stockée en base (`billing.features` × `billing.plan_features`) : la modifier ne demande aucun changement de code. Les surcharges par client passent par `billing.organization_feature_overrides`.

---

## 7. Plateforme d'administration (back-office)

Application séparée (`admin.<domaine>`), authentification distincte, **2FA obligatoire**, liste blanche d'IP, sessions courtes, **chaque action d'un admin est auditée**. Rôles : Super admin, Finance, Support, Modération, Ops.

| Module | Contenu |
|---|---|
| Pilotage | Revenu récurrent, crédits vendus / consommés, **marge réelle par modèle et par plan**, coûts fournisseurs vs revenus, rétention |
| Clients | Recherche, changement de plan, surcharges de droits, suspension, connexion « en tant que » (motif + ticket + consentement, tracée) |
| Finance | Transactions, rapprochement agrégateurs, factures et avoirs, remboursements, crédits offerts, versements créateurs, TVA |
| Tarification | Prix des modèles, coefficients, taux de change, éditeur de plans et de la grille, packs, codes promo, parrainage |
| Fournisseurs | Comptes, clés (coffre), paliers et limites, santé, **solde prépayé et recharge automatique** |
| Gateway | Profils Flash/Smart/Max → modèles réels, règles de routage et de bascule |
| **IA de la plateforme** | Prompts système de nos fonctions IA internes (versions, comparaison, **évaluation obligatoire avant production**, A/B, retour arrière), garde-fous (détecteurs, seuils, profils, rattachements), file des faux positifs, **arrêts d'urgence**, modèles autorisés par plan et région, coûts de l'IA interne — voir `05-garde-fous-ia.md` |
| **API et clés** | Versions de l'API (bêta, courante, dépréciée, retirée), politiques de rate limit (globales, par plan, par client, par IP), clés API des clients (consultation des métadonnées, révocation), comptes de service internes (rotation), clés API d'administration (expirantes) |
| MCP et connecteurs | Suspension, résultats des scans de sécurité, connecteurs officiels |
| Agents | Détection des agents qui s'emballent, arrêt d'urgence global ou par client |
| Marketplace | File de revue Verified / Premium, signalements, sanctions |
| Sécurité et abus | Multi-comptes Free, fraude, alertes de contenu, liste de blocage |
| Conformité | Demandes d'accès / export / suppression, registre des traitements, sous-traitants, violations, autorisations de transfert |
| Support | Tickets avec SLA par plan, notes internes, vue complète du client |
| Système | Liens Grafana, GlitchTip, files, Temporal ; page de statut et incidents (remboursement auto des crédits) |
| Déploiement progressif | **Feature flags** par plan, pays, client, pourcentage — interrupteur d'urgence |
| Contenu | Traductions, messages d'erreur bilingues, modèles d'emails / SMS / WhatsApp, annonces |
| **Paramètres** | Maintenance (globale ou par service, lecture seule, message), inscriptions (ouvertes / liste d'attente / invitation / fermées), pays / devises / langues actifs, agrégateurs et routage des paiements, fournisseurs email / SMS, sécurité (mots de passe, 2FA, sessions), limites par défaut, offre Free, documents légaux et suivi d'acceptation, **marque (nom provisoire)**, rétention, cookies |

---

## 8. Infrastructure

- **Production :** VPS-4 OVH (8 vCores, 24 Go, 200 Go NVMe, France) en Docker Compose.
- Détail des services, bibliothèques, migrations et organisation du dépôt : `03-architecture-technique.md`.
- **Services :** Nginx · Nuxt (dashboard + admin) · API Hono (API + runtime MCP + workers, un seul code, plusieurs processus) · PostgreSQL 18 + pgvector · Redis · ClickHouse · LiteLLM · Temporal · Infisical · OPA · Langfuse · **GlitchTip** (erreurs, compatible SDK Sentry) · **Grafana + Prometheus + Loki + Tempo** (supervision via OpenTelemetry). Tout est gratuit et open source ; ~12–13 Go de RAM sur 24.
- **Stockage fichiers :** compatible S3 (MinIO local ou OVH Object Storage).
- **Sauvegardes :** sauvegarde quotidienne OVH **+** `pg_dump` chiffré vers un stockage externe.
- **Plus tard :** VPS-1 pour le staging ; séparation application / données sur deux serveurs.
- **Développement :** système multi-agent sur Claude Code cloud.

---

## 9. Juridique et conformité

- **Entité :** SARL au Cameroun (légalisation fin d'année). Comptes fournisseurs et agrégateurs **à migrer** vers la SARL. Le Cameroun est supporté par Anthropic et par OpenAI.
- **Fournisseurs :** autorisé = faire fonctionner notre produit ; interdit = revendre des clés / l'accès brut, contourner les limites (multi-comptes). Demande d'approbation écrite facultative mais recommandée.
- **Données personnelles :** loi n° 2024/017 (en vigueur depuis juin 2026 : autorisation préalable pour les transferts hors du Cameroun, registre, notification des violations) + RGPD pour l'Europe. Région par organisation prévue ; masquage optionnel des données personnelles avant l'appel au modèle ; options zéro rétention.
- **Région de données :** V1 en France (OVH n'a pas de datacenter en Afrique) → le stockage des données de clients camerounais en France est un transfert à faire autoriser. Région africaine ajoutée plus tard pour les entreprises qui l'exigent.
- **À produire plus tard :** CGU, CGV, contrat de traitement des données (DPA), politique de confidentialité, contrat éditeur Marketplace.

---

## 10. Déploiement progressif

Tout est prévu dès le schéma de données ; les surfaces s'ouvrent par feature flags.

1. **Fondations** — organisations, workspaces, rôles, portefeuille, budgets, gateway, coffre, observabilité, bilingue, multi-devises, back-office.
2. **MCP Builder** — tous les publics ; OAuth pour Claude / ChatGPT.
3. **SDK + capacités** — `ai.run`, Prompt Studio, optimisation.
4. **Agent Studio** — déclencheurs, approbations, mémoire.
5. **Entreprise** — SSO, rôles avancés, export de l'audit.
6. **Marketplace.**

---

## 11. Journal des décisions

Voir `06-journal-decisions.md` (source unique des décisions).

## 12. Points ouverts

- Nom définitif.
- Simulation des marges et prix définitifs (HT / TTC).
- Conventions UI/UX et design system (en cours avec Claude Design).
- CGU, DPA, politique de confidentialité.
- Démarches auprès de l'Autorité camerounaise (autorisation de transfert) une fois la SARL constituée.
