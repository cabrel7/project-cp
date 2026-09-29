# UI/UX — référence

> **Nom de code :** `project-cp` · v1 · 29 septembre 2026
> **Source de vérité visuelle :** le design system « project-cp » dans Claude Design (tokens, charte, patterns, 27 composants). Ce document résume les décisions et renvoie au design system pour le détail.

## Décisions
- **Direction :** « Fusion A — Warm Tech », améliorée. Fond crème chaud, violet (action et identité), corail (chaleur), ambre (crédits).
- **Thèmes :** clair par défaut, sombre complet, suivi du réglage système. Tous les textes à ≥ 4,5:1 dans les deux thèmes.
- **Philosophie ELS :** simple par défaut. Le mode **Simple / Technique** est mémorisé par utilisateur ; le mode Technique ajoute du détail sans changer la structure des écrans.
- **Polices :** Plus Jakarta Sans (titres), Geist (interface), Geist Mono (code).
- **Icônes :** Lucide ; pas d'emoji.
- **Mobile d'abord** pour le chat, les approbations, le portefeuille et les notifications ; pages légères ; états hors ligne.
- **Mouvement :** fonctionnel partout (150–250 ms) ; **illustrations animées** permises uniquement sur l'accueil, l'authentification et l'onboarding (formes de marque abstraites, sans libellés, rythmes irréguliers et liens courbes) ; fondus seuls si `prefers-reduced-motion`.
- **Authentification :** e-mail + mot de passe, téléphone + code SMS, clé d'accès, Google et Apple (pas GitHub). Connexion et inscription en deux colonnes sur desktop (panneau animé à gauche, fondu dans la page, sans séparateur) ; étapes intermédiaires (code, 2FA, mot de passe, autorisation OAuth) en carte centrée.
- **Discours :** toujours parler de la plateforme entière, jamais du seul MCP.
- **Méthode :** on ne dessine pas tous les écrans. Chaque écran = un des 8 gabarits + des composants du système.

## Améliorations apportées à la Fusion A
1. **Violet d'action plus foncé** (`primary` #5B50C8) : le violet d'origine (#7F77DD) ne passait pas le contraste pour du texte ou un bouton. Il reste la couleur d'identité (`brand-violet`).
2. **Corail réservé à la chaleur**, jamais à l'erreur ; texte sur corail en encre foncée, pas en blanc. L'erreur a son propre rouge (`danger`), plus sombre.
3. **Ambre dédié aux crédits** : le portefeuille a une couleur à lui, distincte des avertissements.
4. **Statuts complets** (succès, attention, erreur, info) avec fonds doux, toujours accompagnés d'une icône et d'un mot.
5. **Thème sombre conçu** : violet nuit, et non une simple inversion.
6. **Palette de graphiques à 6 couleurs** validée (daltonisme, contraste) dans les deux thèmes.
7. **Deux polices au lieu de trois familles concurrentes** (Geist + Plus Jakarta Sans), plus Geist Mono pour le code.

## Gabarits de page (détail : section *Patterns* du design system)
G1 Liste · G2 Détail · G3 Assistant pas à pas · G4 Tableau de bord · G5 Réglages · G6 Conversation · G7 Éditeur visuel · G8 Écran d'autorisation.

## Composants (27)
- **Actions :** Button
- **Saisie :** TextField, Select, Switch, ModeToggle, SecretField
- **Statut :** StatusBadge, RiskTag
- **Retour :** Alert, Toast, ConfirmDialog, EmptyState, Skeleton
- **Données :** StatTile, CreditMeter, DataTable, Chart, Timeline
- **Navigation :** AppShell, PageHeader, Tabs, Stepper, FilterBar
- **IA :** ApprovalCard, ChatMessage, PlanGate, CodeBlock

## Navigation définitive (barres latérales)
Une seule barre latérale pour tous les profils ; seuls les **libellés** changent entre les modes Simple et Technique. Les fonctions hors plan restent visibles et mènent à un `PlanGate` (jamais masquées). Composants de référence : `NavApp` et `NavAdmin` (canevas, page 7).

**Application client** (Simple / Technique)
- Accueil · Discuter · À valider / Approbations
- **Construire** : Accès IA / Serveurs MCP · Systèmes connectés / Connecteurs · Assistants / Agents · Fonctions IA / Capacités · Marketplace
- **Suivre** : Activité / Exécutions · Utilisation et coûts / Utilisation
- **Développeurs** : Clés d'accès / Clés d'API · Webhooks · Mode test / Environnements · Documentation (lien externe)
- **Organisation** : Équipe et rôles / Membres et rôles · Crédits et facturation · Budgets · Sécurité et audit / Politiques et audit · Réglages
- En bas : sélecteur d'organisation et de workspace (nom + formule). Barre du haut : environnement (Technique), recherche, crédits, notifications, bascule Simple/Technique, profil.

**Administration** (`admin.<domaine>`)
- Pilotage
- **Clients et revenus** : Clients · Finance · Tarification et plans
- **IA** : Fournisseurs · Gateway et routage · IA de la plateforme (onglets : Capacités internes · Garde-fous · Arrêts d'urgence · Modèles autorisés · Coûts)
- **Produit** : API et clés · MCP et connecteurs · Agents · Marketplace
- **Confiance** : Sécurité et abus · Conformité · Support
- **Exploitation** : Système et incidents · Déploiement progressif · Contenu et traductions · Équipe interne et audit · Paramètres
- Barre du haut : badge d'environnement, recherche globale, durée de session restante, bouton **Arrêt d'urgence** toujours visible, profil (rôle + 2FA).

## Studios
- **Agent Studio** : création en 4 étapes (Objectif décrit en français → proposition de l'IA · Accès par action : autorisée / à valider / interdite · Démarrage et règles · Essai sans effet) ; fiche agent à onglets (Vue d'ensemble, Configuration, Accès, Déclencheurs, Exécutions, Mémoire, Versions) ; page d'exécution avec approbation modifiable (décocher un élément, corriger avant d'approuver).
- **Prompt Studio** (capacités) : versions figées, éditeur (consignes, gabarit avec variables, schéma de sortie, profil, garde-fous), essai avec coût et modèle utilisé ; évaluations comparées par version, seuil de mise en production, test A/B, retour arrière.
- **IA de la plateforme** (admin) : même outillage ; mise en production **bloquée** sous le seuil d'évaluation, sans contournement ; arrêt d'urgence par capacité, motif obligatoire.

## Règles pour les agents
- Lire le README du design system, puis ses sections *Patterns* et *Contenu* avant tout écran.
- Choisir un gabarit ; n'utiliser que les tokens (aucune couleur ou taille en dur).
- Textes via i18n, en suivant le glossaire Simple / Technique.
- Un besoin non couvert s'ajoute d'abord au design system, puis se code.

## À faire ensuite
- ✅ Maquettes de validation (canevas Claude Design « project-cp — Maquettes de validation ») : authentification, onboarding, tableau de bord, MCP Builder, studios, admin IA, navigation (pages 1 à 7).
- **Onboarding :** 3 étapes, **3 profils** (le profil ne donne aucun droit, il choisit ce qui est mis en avant ; les droits viennent du plan). Activité → objectif puis premier outil ; applications → choix d'une capacité prête puis branchement (assistant de code, SDK ou API), une clé par app ; entreprise → organisation, invitations, budget.
- Traduire les tokens en thème Nuxt UI + Tailwind v4 (`packages/ui`).
