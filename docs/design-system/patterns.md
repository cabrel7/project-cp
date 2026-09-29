# Patterns

Tout écran est l'assemblage d'un **gabarit de page** et de **patterns d'interaction** ci-dessous, avec les composants du système. Les agents qui implémentent choisissent d'abord le gabarit, puis remplissent ses zones ; ils n'inventent pas de mise en page.

## Gabarits de page

### G1 — Liste
Pour : agents, serveurs MCP, connecteurs, clés API, runs, factures, membres, et toutes les tables de l'admin.
- `PageHeader` : titre `heading-1`, une phrase d'explication en `ink-muted` (mode Simple), bouton principal à droite (« Créer un agent »).
- `FilterBar` : recherche, 1 à 3 filtres, vues enregistrées ; en mode Technique, filtres avancés.
- `DataTable` : colonnes essentielles en Simple (nom, statut, dernière activité, action) ; colonnes techniques en plus en Technique (identifiant, version, coût).
- Ligne cliquable vers le gabarit Détail ; actions secondaires dans un menu « … ».
- Vide : `EmptyState` avec l'action principale. Chargement : `Skeleton` de lignes. Mobile : la table devient une liste de cartes.

### G2 — Détail
Pour : un agent, un serveur MCP, un connecteur, un run, une organisation (admin).
- `PageHeader` avec fil d'Ariane, nom, `StatusBadge`, actions (principale + menu).
- `Tabs` : Vue d'ensemble · Configuration · Activité · (Réglages). L'onglet Vue d'ensemble répond à « est-ce que ça marche et combien ça coûte ? » avec des `StatTile` et la dernière activité.
- ≥ `bp-xl` : panneau latéral droit pour les métadonnées ; en dessous, elles passent sous le contenu.

### G3 — Assistant (création pas à pas)
Pour : connecter un système, créer un serveur MCP, créer un agent, publier sur la Marketplace, onboarding.
- `Stepper` en haut (3 à 5 étapes, titres courts), contenu dans `reading-max`, boutons « Retour » et « Continuer » en bas (collants sur mobile).
- **Brouillon sauvegardé automatiquement** à chaque étape ; on peut quitter et reprendre.
- Chaque étape pose une seule question. Les réglages avancés sont repliés (« Options avancées ») et ouverts d'office en mode Technique.
- Dernière étape = récapitulatif en langage clair + action finale (« Publier »). Succès : écran de fin avec la prochaine action.

### G4 — Tableau de bord
Pour : accueil du workspace, consommation, admin « Pilotage ».
- Rangée de 3 à 4 `StatTile` (chiffre, variation, lien).
- `CreditMeter` du portefeuille et des budgets.
- 1 à 2 graphiques (`Chart`) maximum au-dessus de la ligne de flottaison, filtres de période sur une ligne au-dessus.
- Liste « À faire » : approbations en attente, erreurs, étapes d'onboarding restantes.

### G5 — Réglages
Pour : organisation, workspace, profil, facturation, paramètres admin.
- Navigation de sections à gauche (≥ `bp-lg`) ou liste (mobile) ; chaque section est une carte avec titre, explication, champs, et bouton « Enregistrer » propre à la section.
- Zone dangereuse (suppression, transfert) en dernier, dans une carte à bordure `danger`, avec `ConfirmDialog`.

### G6 — Conversation
Pour : chat du workspace, agent conversationnel, copilote d'onboarding.
- Fil de `ChatMessage`, zone de saisie en bas, suggestions de questions au démarrage.
- Les appels d'outils apparaissent en puces repliables (« A consulté les commandes ») ; les actions à valider en `ApprovalCard` dans le fil.
- Mobile d'abord.

### G7 — Éditeur visuel
Pour : cartographie des outils MCP, enchaînement d'un agent (Vue Flow).
- Canevas au centre, palette d'éléments à gauche, panneau de propriétés à droite, barre d'actions en haut (Tester, Publier).
- Toujours une vue liste équivalente pour le mode Simple et l'accessibilité.

### G8 — Écran d'autorisation
Pour : consentement OAuth (Claude, ChatGPT), acceptation des CGU, approbation d'une action depuis un lien.
- Carte centrée `reading-max` sur `canvas`, qui demande, quoi exactement (liste de permissions en clair), deux boutons (« Autoriser » / « Refuser »).

## Patterns d'interaction

- **Mode Simple / Technique** (`ModeToggle`) : même écran, deux niveaux de détail. Le mode Technique ajoute, il ne remplace pas. Vocabulaire : voir *Contenu*.
- **Action risquée** : le niveau de risque décide de la confirmation. Faible : aucune. Moyen : `ConfirmDialog` simple. Élevé ou critique : `ConfirmDialog` qui résume l'effet, avec saisie du nom pour une suppression définitive. Les actions IA à risque passent par `ApprovalCard`.
- **Secret affiché une fois** (`SecretField`) : clé API, jeton MCP. Bouton copier, avertissement « vous ne pourrez plus la voir », puis seul le préfixe reste visible.
- **Opération longue** (publication MCP, run, import) : barre ou étapes en direct (`Timeline`), l'utilisateur peut quitter ; une notification l'avertit à la fin.
- **Fonction non incluse dans le plan** (`PlanGate`) : on montre la fonction, grisée, avec ce qu'elle apporte et le plan qui l'inclut. Jamais une page d'erreur.
- **Fonction pas encore ouverte** (feature flag) : on ne l'affiche pas.
- **Erreurs** : `Alert` avec phrase humaine, action proposée et, en mode Technique, le code (`MCP_TOOL_INPUT_INVALID`) et l'identifiant de requête copiable.
- **Crédits et argent** : montants FCFA sans décimales avec espace fine (« 4 900 FCFA »), crédits « 12 430 cr », toujours la devise ; le coût d'une action est annoncé avant quand il est notable.
- **États de chaque zone** : chargement (`Skeleton`), vide (`EmptyState`), erreur (`Alert` + réessayer), partiel/hors ligne (bandeau `warning` « Connexion instable — vos changements seront envoyés dès le retour du réseau »).
- **Contenu généré par l'IA** : petite mention `caption` « Généré par l'IA » et, pour les propositions (outils MCP, configuration d'agent), un état « Proposé » à valider.
- **Notifications** : `Toast` pour la confirmation d'une action de l'utilisateur (4 s) ; centre de notifications pour les événements (runs, approbations, paiements).
- **Mobile** : barre d'actions en bas, tiroirs en plein écran, tableaux en cartes, cibles ≥ 44px.
