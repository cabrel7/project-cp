# Règles métier — v2

> **Nom provisoire :** `project-cp`. Remplace « Règles Métier Complètes — AXON » (v1, archivée).
> Chaque règle indique, quand c'est utile, **où elle est garantie** : `[DB]` = contrainte / trigger en base, `[APP]` = logique applicative, `[RLS]` = sécurité au niveau des lignes.
> Date : 29 septembre 2026.

---

## 1. Cycles de vie

### 1.1 Serveur MCP
```
DRAFT → VALIDATING → ACTIVE → DEPRECATED → ARCHIVED
            │           │
          FAILED     SUSPENDED (violation de sécurité, décision admin)
```
- Publier crée une **version** (`mcp.server_versions`) : instantané **immuable** de toute la configuration résolue (outils, schémas, règles). `[DB]` trigger d'immutabilité.
- Le serveur pointe vers une **version active**. Rollback = changer de version active, en un clic.
- ACTIVE uniquement après validation réussie (5 étapes, §4.1). `[APP]`
- DEPRECATED seulement s'il existe une version plus récente active. `[APP]`
- SUSPENDED : réactivation par un admin uniquement. `[APP]`
- Pas de suppression physique : ARCHIVED (+ `deleted_at`). `[DB]` soft delete.

### 1.2 Agent
```
DRAFT → ACTIVE ⇄ PAUSED → ARCHIVED
```
- « En cours d'exécution » n'est pas un statut de l'agent : c'est l'état de ses **runs**.
- DRAFT : ne peut pas être déclenché, même manuellement. `[APP]`
- Un agent avec un run actif ne peut pas être archivé sans arrêt forcé. `[APP]`
- PAUSED conserve configuration et historique ; `paused_reason` (utilisateur, connecteur en erreur, budget). `[DB]`
- Une seule exécution à la fois par défaut (`max_concurrency = 1`), plus si configuré et autorisé par le plan. `[DB]` + `[APP]`
- Chaque modification crée une **nouvelle version immuable** ; chaque run référence la version utilisée. `[DB]`

### 1.3 Connecteur
```
DRAFT → TESTING → ACTIVE → ERROR
                    │
                 REVOKED (identifiants expirés / révoqués) → ARCHIVED
```
- ERROR ou REVOKED ⇒ outils dépendants indisponibles ; agents concernés passés en PAUSED avec notification. `[APP]`
- Contrôle de santé toutes les 15 min sur les connecteurs actifs ; historique conservé 30 jours. `[APP]` `[DB]`

### 1.4 Run (toute exécution facturable)
```
QUEUED → RUNNING → COMPLETED
            ├── AWAITING_APPROVAL → RUNNING
            ├── FAILED
            ├── TIMEOUT
            ├── CANCELLED
            └── BUDGET_EXCEEDED
```
- Un run a une **source** : SDK, chat, agent, MCP externe, playground, évaluation, système. `[DB]`
- QUEUED annulé ⇒ aucun crédit débité.
- FAILED / TIMEOUT / CANCELLED ⇒ seuls les crédits réellement consommés sont débités.
- AWAITING_APPROVAL ⇒ aucune consommation pendant l'attente.
- Un run terminé ne reprend pas ; on peut le **rejouer** (nouveau run, `replay_of_run_id`). `[DB]`
- Durée max configurable (défaut 5 min, max 30 min) ; itérations max (défaut 10, max 50) ; profondeur d'imbrication max 5. `[DB]` bornes.

---

## 2. Organisation, accès, workspaces

- Une organisation a **exactement une souscription vivante** (trialing, active, past_due, grace). `[DB]` index unique partiel.
- Rôles système : Owner, Admin, Developer, Operator, Viewer. Rôles personnalisés : Enterprise. Équipes : Business+.
- Toujours au moins un Owner ; un Owner transfère son rôle avant de partir. `[APP]`
- Invitations valables 7 jours ; une seule invitation en attente par email et par organisation. `[DB]`
- Un utilisateur peut appartenir à plusieurs organisations.
- **Isolation totale entre organisations** : chaque table client porte `organization_id`, protégée par RLS, et les liens internes utilisent des clés étrangères composites `(id, organization_id)` qui rendent impossible de rattacher un objet d'un client à un autre. `[DB]` `[RLS]` (testé)
- Suppression d'organisation : 30 jours de grâce (lecture seule, aucun run), puis suppression / anonymisation. Les écritures financières (grand livre, factures) sont conservées selon les obligations comptables et anonymisées. `[APP]`
- Environnements : dev, staging, production, **sandbox** (outils simulés, crédits de test séparés). Configurations, budgets, identifiants et clés API peuvent différer par environnement.

---

## 3. Crédits, portefeuilles, budgets

### 3.1 Nature des crédits
- 1 crédit = **1 FCFA de valeur de consommation** ; prépaiement de services, **non transférable entre organisations**, sans valeur monétaire. `[APP]` + CGU.
- Stockés en **micro-crédits** (1 cr = 1 000 000 µcr) pour les fractions (0,1 cr). `[DB]`
- Trois portefeuilles par organisation : **LLM**, **infra**, **test** (sandbox). Portefeuilles de workspace optionnels (allocation depuis l'organisation). `[DB]`

### 3.2 Lots et expiration
- Chaque entrée de crédits est un **lot** (inclus au plan, achat, bonus, parrainage, promo, remboursement, geste commercial). `[DB]`
- Consommation **FIFO par date d'expiration**. `[DB]` index dédié + `[APP]`
- Achats : n'expirent pas. Bonus / parrainage : 6 mois. Crédits inclus au plan : valables sur la période ; **perdus au downgrade** ; recalculés au prorata à l'upgrade.

### 3.3 Grand livre
- Chaque mouvement est une écriture **en ajout seul** avec le solde après écriture ; les corrections passent par des écritures inverses. `[DB]` trigger (testé)
- Chaque débit est ventilé : organisation → workspace → environnement → projet → run. `[DB]`

### 3.4 Réservation et solde
- Au démarrage d'un run : **réservation** d'un montant estimé ; à la fin : régularisation au coût réel. `[DB]` `credit_reservations`
- Le solde ne peut jamais passer sous zéro, sauf un **découvert technique** (paramètre, défaut 1 000 cr) qui permet à un run déjà lancé de se terminer. `[DB]` contrainte (testée)
- Nouveau run refusé si le solde disponible (solde − réservations) est insuffisant **ou** si un budget applicable est épuisé.

### 3.5 Calcul d'un débit
```
crédits LLM = coût fournisseur (USD) × taux USD→XAF en vigueur × coefficient du plan
crédits infra = unités consommées × tarif du compteur (par plan ou par défaut)
```
- Prix des modèles par déploiement et par unité (tokens entrée / sortie / cache, raisonnement, embeddings, image, seconde audio, caractère TTS, page, seconde vidéo, requête), **datés sans chevauchement**. `[DB]` contrainte d'exclusion
- Chaque requête garde le **taux de change** et le **coefficient** appliqués (traçabilité). `[DB]`
- **BYOK** : les tokens ne consomment pas de crédits LLM ; seuls les crédits infra (dont 0,1 cr par requête gateway) sont débités.

### 3.6 Remboursements automatiques
- Erreur interne de la plateforme pendant un run ⇒ crédits remboursés.
- Aucun fournisseur disponible (non récupérable) ⇒ remboursés.
- Système externe injoignable après toutes les relances ⇒ remboursement partiel.
- Incident déclaré sur la page de statut ⇒ remboursement selon la politique de l'incident.
Le catalogue `platform.error_codes` indique pour chaque code s'il déclenche un remboursement.

### 3.7 Budgets
- Portée : organisation, workspace, environnement, projet, équipe, agent, clé API, **utilisateur final**. `[DB]`
- Périodes : quotidienne, hebdomadaire, mensuelle, personnalisée.
- Seuils d'alerte (défaut 70 % et 90 %) ; action au dépassement : alerte seule, blocage des nouveaux runs, blocage total.
- Le budget s'ajoute au portefeuille, il ne le remplace pas.
- Consommation suivie en temps réel (Redis), consolidée par période en base.

---

## 4. MCP : fiabilité, runtime, sécurité

### 4.1 Validation avant publication (5 étapes)
1. **Structure** : noms uniques en snake_case, descriptions non vides (≥ 10 caractères), schémas JSON valides. `[DB]` partiellement
2. **Connectivité** : connexion et authentification au système externe.
3. **Tests** : exécution de chaque outil avec des données de test ; conformité au schéma de sortie.
4. **Sécurité** : détection d'injection dans les descriptions, permissions déclarées = permissions réelles, périmètre respecté.
5. **Sémantique** : score de qualité des descriptions, suggestions.
Échec ⇒ FAILED avec rapport détaillé (`validation_report`).

### 4.2 Runtime multi-tenant piloté par configuration
- Un **seul service** sert tous les serveurs : `mcp.<domaine>/{serveur}`. Aucun code généré, aucun déploiement par client.
- Chaque appel : jeton vérifié → organisation + utilisateur + portées → version active (cache Redis) → outils filtrés par policy (et par tool routing si activé) → validation des paramètres → policy → approbation si requise → secret récupéré dans le coffre → exécuteur du connecteur → sortie nettoyée → audit + débit.
- Les connecteurs à risque (SQL, code personnalisé plus tard) s'exécutent dans un **pool de workers séparé**.

### 4.3 Fiabilité en production
- Ping toutes les 5 min, outil de contrôle toutes les 15 min ; 3 échecs ⇒ WARNING ; 5 échecs ⇒ ERROR et agents dépendants en PAUSED.
- Timeout par outil (défaut 30 s, max 120 s). `[DB]` bornes
- Relances : 3 tentatives, attente 1 s / 3 s / 9 s ; ensuite erreur structurée pour l'agent.
- Circuit breaker : > 5 échecs en 1 min ⇒ ouvert 2 min ⇒ appel test ⇒ refermé si OK.
- Un outil en erreur n'affecte ni les autres outils ni les autres serveurs.
- Versions sémantiques ; un agent peut épingler une version de serveur ; coexistence pendant une transition.

### 4.4 Règles de risque des outils
- Effet : lecture, écriture, suppression, financier, message externe.
- **Suppression et financier exigent toujours une approbation humaine.** `[DB]` contrainte (testée)
- Outils critiques désactivés par défaut.
- Règles d'approbation conditionnelles possibles (ex. commande > 500 000 FCFA).

### 4.5 Connecteur base de données
- **Jamais de SQL libre** : outils = requêtes **paramétrées** générées à la configuration et **validées par l'utilisateur** ; le modèle ne fait que remplir les paramètres.
- **Aucune action SQL de suppression** ; pas de DDL. `[DB]` contrainte (testée) + `[APP]` analyse syntaxique (requêtes multiples et DDL rejetés).
- Lecture seule par défaut ; utilisateur de base **dédié** exigé ; droits vérifiés à la connexion ; **compte superutilisateur refusé**.
- Écritures en liste blanche : tables précises, filtre par clé primaire, une ligne maximum, transaction, aperçu, approbation.
- `statement_timeout`, limite de lignes, masquage des colonnes sensibles.
- Réseau : bridge en connexion **sortante** (aucun port entrant chez le client), sinon liste blanche d'IP + TLS ; réplica en lecture recommandé.
- Audit complet et alerte sur les volumes anormaux.

### 4.6 Authentification des clients MCP
| Mode | Pour | Règles |
|---|---|---|
| **OAuth 2.1** (requis dès la V1) | Claude, ChatGPT, tout client conforme | Enregistrement dynamique des clients, code + **PKCE S256 obligatoire**, indicateur de ressource, consentement explicite par serveur et par portée, jeton d'accès court + refresh avec **rotation** (réutilisation détectée ⇒ révocation de la famille) |
| Jeton statique | Cursor, Claude Desktop (configuration manuelle) | Préfixe affichable, haché en base, portée read_only / read_write / full / liste d'outils, expiration optionnelle, révocable |
| Clé API | SDK | Liée à un environnement, portées, IP et origines autorisées |
- Visibilité d'un serveur : privé, organisation, public (Marketplace).
- Dépassement de débit ⇒ 429 + `Retry-After`.

### 4.7 Protections systématiques
- Paramètres validés contre le schéma avant tout appel externe (sinon 422).
- Entrées venant d'un modèle traitées comme **non fiables** ; sorties nettoyées avant retour au modèle.
- Secrets injectés au moment de l'exécution, jamais dans les paramètres, les journaux ou les réponses.

---

## 5. Agents : configuration et limites

**Configurable :** nom, objectif, instructions, langue ; profil de modèle ou modèle forcé ; température (défaut 0,3) ; tokens max par appel ; itérations (≤ 50) ; durée (≤ 30 min) ; timeout d'outil (≤ 120 s) ; profondeur (≤ 5) ; mode de sortie (texte, JSON avec schéma obligatoire, action) ; mémoire (portée agent ou workspace, rétention selon le plan) ; approbations (délai défaut 24 h, canaux) ; budget par run (arrêt ou demande d'autorisation) ; **horaires autorisés** ; accès MCP granulaires (serveur, version épinglée, outil, autoriser / approbation / refuser) ; **capacités accordées**, appelées comme des outils (autoriser / approbation / refuser). `[DB]` même organisation uniquement (test T19)

**Actions sur soi-même :**
- Autorisé : lire son historique, écrire dans sa mémoire, notifier.
- Interdit par défaut (activable) : déclencher / modifier d'autres agents.
- Toujours interdit : s'appeler lui-même en boucle, accéder à une autre organisation, lire le coffre, contourner une approbation.

**Approbations :** l'humain voit un résumé en langage clair, peut **corriger les paramètres** avant d'approuver ; expiration ⇒ run annulé.

**Actions disponibles :** créer (à partir de zéro ou d'un modèle Marketplace), modifier (DRAFT / PAUSED ⇒ nouvelle version), dupliquer, activer / mettre en pause, déclencher, arrêter de force, voir en temps réel, rejouer un run, exporter / importer (sans identifiants), publier, archiver.

---

## 5 bis. Capacités et routage des modèles

### 5 bis.1 Capacités
- Une **capacité** = une tâche d'IA prête à l'emploi, nommée (`extraire-facture`) : consignes, profil ou modèle, format de sortie, garde-fous, outils éventuels ; versionnée, mise en production par environnement, test A/B, évaluations.
- Appelée depuis une app (SDK / API : `ai.run`), un client MCP, **ou un agent** (capacité accordée à la version de l'agent, appel tracé comme étape `capability_call`).
- **Visibilité** : `private` (workspace de création, défaut) · `organization` (tous les workspaces) · `public` (uniquement par publication sur la Marketplace). Rien ne devient public sans publication volontaire.
- Les droits d'usage viennent du plan et du rôle, jamais du profil d'onboarding.

### 5 bis.2 Choix du modèle (résolution)
Le réglage le plus précis l'emporte :
1. **Modèle fixé** sur la version de la capacité ou de l'agent — mode Technique, **plan Pro et plus** (`ai.model_override`), modèle autorisé par le plan.
2. **Profil** de la capacité ou de l'agent (Flash / Smart / Max, ou profil personnalisé dès Pro).
3. **Profil par défaut** du workspace, puis de l'organisation.
4. **Défaut du plan** : Flash (Free), Smart (autres plans).

Un profil demandé hors plan est refusé (`PLATFORM_FEATURE_NOT_AVAILABLE`), jamais rétrogradé en silence.

### 5 bis.3 Choix du modèle réel dans un profil
- Filtrage des candidats : fonctions requises (outils, JSON structuré, vision, audio…), taille de l'entrée ≤ contexte du modèle, **région de données**, modèles `BYOK uniquement`.
- **BYOK prioritaire** : si l'organisation a une clé valide chez le fournisseur du modèle retenu, elle est utilisée (crédits infra seulement).
- Parmi les candidats restants : règles de routage de l'admin (conditions, ordre, poids).
- Coût estimé vérifié avant l'appel (réservation sur le portefeuille et les budgets).

### 5 bis.4 Bascule
- Déclencheurs : indisponibilité, délai dépassé, limitation de débit, erreur fournisseur, disjoncteur ouvert (fournisseur en échec répété mis de côté temporairement), contexte trop long.
- Bascule vers le **candidat suivant du même profil**, avec les mêmes contraintes (fonctions, région, budget). **Jamais vers un profil plus cher** sans accord explicite.
- **Modèle fixé indisponible** : par défaut **bascule vers le profil** et signalement dans les journaux ; option `échouer` réservée au mode Technique (`model_fallback`). `[DB]`
- **Constance** : un agent garde le même modèle pendant tout un run, sauf bascule.
- **Traçabilité** : chaque appel enregistre le modèle, l'origine du choix (`routing_source`), la règle appliquée et la raison d'une bascule (`fallback_reason`) ; l'interface affiche « Modèle utilisé : X (profil Équilibré) ». `[DB]`

---

## 6. Paiements et facturation

- Plusieurs agrégateurs ; routage par pays et opérateur selon la priorité. **Aucun KYC demandé aux utilisateurs.**
- Chaque paiement a une **clé d'idempotence** ; les webhooks d'agrégateurs sont journalisés, vérifiés (signature) et dédupliqués. `[DB]`
- Suivi de l'encaissement réel (`settled_at`) pour la trésorerie.
- Factures et avoirs **numérotés sans trou** par série et par année ; données de facturation figées à l'émission. `[DB]`
- Renouvellement : rappel 5 jours avant ; échec ⇒ `past_due` → période de grâce → retour au plan Free (données conservées).
- Moyens : Mobile Money (principal), carte (diaspora), virement (Enterprise).

---

## 7. Marketplace

- **Types :** serveur MCP, modèle d'agent, modèle de prompt, **capacité**, bundle.
- **Livraison d'une capacité, d'un prompt ou d'un modèle d'agent :** **scellée** par défaut (l'acheteur l'utilise, sans jamais voir ni modifier le prompt ; mises à jour poussées par l'éditeur) ou **copie modifiable** si l'éditeur le choisit. `[DB]` capacité scellée non modifiable (test T18)
- **Niveaux :** Community (publication libre, **code source public obligatoire**, scan automatique), Verified (revue manuelle 3–5 jours ouvrés, badge), Official (créé par la plateforme, gratuit), Premium (payant, créateur certifié, contrat, audit, SLA, support).
- **Seuls Premium et Official peuvent être payants.** `[DB]` contrainte
- **Installation :** copie indépendante dans le workspace (scellée ou modifiable selon l'éditeur) ; l'acheteur fournit ses identifiants ; jamais les identifiants, l'historique, la mémoire ou les données du créateur. Mises à jour en opt-in.
- **Compatibilité** vérifiée avant installation (systèmes, connecteurs requis, plan minimum, langues).
- **Prix :** paiement unique, mensuel, à l'usage (% des crédits consommés), freemium.
- **Revenus :** 70 % créateur / 30 % plateforme, versement mensuel le 1er, seuil 5 000 F (cumul sinon), en Mobile Money.
- **Modération :** 3 signalements distincts ⇒ revue ; 1 signalement de sécurité ⇒ suspension préventive ; sanctions : avertissement (7 jours pour corriger), retrait, suspension, bannissement ; réponse sécurité 24 h, standard 72 h, contestation 5 jours ouvrés.

---

## 8. Erreurs

Format unique :
```json
{ "error": { "code": "MCP_TOOL_INPUT_INVALID", "message": "…", "details": {}, "request_id": "req_…", "documentation_url": "…" } }
```
- Catalogue bilingue en base (`platform.error_codes`) : code, statut HTTP, message FR/EN, indice, **relançable ?**, **rembourse les crédits ?**, lien de documentation.
- Familles : AUTH, BILLING, MCP, AGENT, LLM, MARKET, WEBHOOK, IDEMPOTENCY, PLATFORM (57 codes au départ).
- Nouveaux codes v2 : `AUTH_OAUTH_CONSENT_REQUIRED`, `BILLING_PAYMENT_PENDING`, `MCP_SQL_STATEMENT_REJECTED`, `MCP_BRIDGE_OFFLINE`, `AGENT_NESTING_TOO_DEEP`, `AGENT_OUTSIDE_ALLOWED_HOURS`, `LLM_MODEL_BYOK_ONLY`, `MARKET_ITEM_INCOMPATIBLE`, `MARKET_ENTITLEMENT_REQUIRED`, `WEBHOOK_SIGNATURE_INVALID`, `IDEMPOTENCY_KEY_REUSED`, `PLATFORM_FEATURE_DISABLED` (flag) — à distinguer de `PLATFORM_FEATURE_NOT_AVAILABLE` (plan).
- Comportements : bascule automatique de fournisseur ; relance transparente sur limite fournisseur ; 3 relances vers un système externe ; notifications (paiement échoué, identifiants refusés, crédits à 20 %).

---

## 9. Droits de plan vs feature flags

- **Droit de plan** (`billing.features`) : ce qu'un client **a le droit** d'utiliser selon son plan (limites, options). Refus ⇒ `PLATFORM_FEATURE_NOT_AVAILABLE`.
- **Feature flag** (`platform.feature_flags`) : si une fonction **existe déjà** pour ce client (déploiement progressif, arrêt d'urgence). Refus ⇒ `PLATFORM_FEATURE_DISABLED`.
- Ordre de vérification : flag → droit de plan → surcharge client → budget / crédits.

---

## 10. Administration

- Équipe interne séparée des utilisateurs clients ; 2FA obligatoire ; IP autorisées ; sessions de 8 h.
- **Toute action d'un admin est auditée** (acteur `staff`).
- Connexion « en tant que » : motif, ticket, consentement du client, lecture seule par défaut, durée limitée, tracée.
- Clés API d'administration : toujours avec expiration.
- Paramètres historisés à chaque modification. `[DB]` trigger
- Permissions sensibles (remboursement, suppression, surcharge de droits) : ré-authentification.
- **Stockage des fichiers (D52)** : plusieurs backends S3 déclarés (serveur local SeaweedFS, OVH Object Storage…). `[DB]`
  - Un seul backend reçoit les nouveaux fichiers par région de données, et il doit être actif. `[DB]` (test T21)
  - Chaque fichier retient son backend ; changer de backend actif ne rend aucun fichier illisible. `[DB]`
  - Migration des fichiers existants : tâche de fond reprenable (copie → vérification de l'empreinte sha256 → bascule → suppression de l'original seulement après vérification) ; une seule migration active par backend source. `[DB]` `[APP]`
  - Bascule et migration : super admin uniquement, motif obligatoire, ré-authentification, audit. `[APP]`
  - Alerte quand l'espace utilisé d'un backend local dépasse son seuil (défaut 80 %). `[APP]`
  - Les clients ne voient ni ne modifient jamais la configuration du stockage. `[DB]` (test T22)

---

## 11. Notifications

- Déclencheurs : crédits à 80 / 50 / 20 / 0 % ; budget à 70 / 90 / 100 % ; run en échec ou timeout ; connecteur en erreur / révoqué ; approbation en attente (compte à rebours) ; serveur MCP en erreur ; nouveau membre ; paiement reçu / échoué ; vente ou signalement Marketplace ; incident.
- Canaux : in-app, email, SMS, **WhatsApp**, webhook, push ; préférences par catégorie et par canal.
- Messages bilingues depuis les modèles gérés dans le back-office.

---

## 12. Rétention et données personnelles

| Donnée | Free | Starter | Pro | Business | Enterprise |
|---|---|---|---|---|---|
| Logs / audit | 7 j | 30 j | 90 j | 180 j | 365 j + (configurable) |
| Mémoire long terme | — | 30 j | 90 j | 180 j | configurable |
| Entrées / sorties des runs | 30 j (paramètre global) | | | | |

- Détail en PostgreSQL puis agrégats et archive analytique (ClickHouse) ; les vieilles partitions sont détachées puis supprimées.
- Export des données disponible avant suppression ; demandes d'accès / export / suppression suivies avec échéance.
- Registre des traitements, liste publique des sous-traitants, registre des violations, autorisations de transfert (loi 2024/017).
- Consentement aux cookies et acceptation des CGU **versionnées** (ré-acceptation si nécessaire).

---

## 13. Limites techniques

| Élément | Limite |
|---|---|
| Fichier importé (connecteur) | 50 Mo |
| Corps de requête API | 10 Mo |
| Prompt système | 100 000 caractères |
| Outils par serveur | selon plan (10 / 30 / 100 / personnalisé) |
| Profondeur d'appels imbriqués | 5 |
| Timeout d'outil | 1 à 120 s |
| Durée d'un run | 10 s à 30 min |
| Clé d'idempotence | valable 24 h |

---

## 14. Support

| Plan | Support |
|---|---|
| Free | documentation |
| Starter | email, réponse 48 h |
| Pro | email 24 h + chat |
| Business | email 12 h + chat |
| Enterprise | dédié, SLA, canal direct (WhatsApp / Slack) |

---

## 15. Garde-fous IA (résumé)

- Aucune action réelle sans contrôles déterministes : politique OPA, bornes des paramètres, approbation. `[APP]` + `[DB]` (suppression / financier ⇒ approbation)
- Les résultats d'outils et documents sont des données, jamais des instructions (marquage + détection d'injection indirecte).
- Profil **Strict** appliqué automatiquement dès qu'un run peut écrire, supprimer, payer ou envoyer un message.
- Tout nouveau détecteur passe d'abord en mode observation.
- Arrêts d'urgence à toutes les échelles (`EMERGENCY_STOP_ACTIVE`).
- Prompts système de la plateforme : aucune mise en production sans évaluation réussie.
- Détail complet : `05-garde-fous-ia.md`.
