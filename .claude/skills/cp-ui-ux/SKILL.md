---
name: cp-ui-ux
description: Règles UI/UX de project-cp — principes universels + design system « Fusion A — Warm Tech » (tokens, 8 gabarits, 27 composants, glossaire Simple/Technique, mouvement, navigation définitive). Lire AVANT toute interface (web, admin, packages/ui) et pour toute revue UX.
---

# UI/UX — project-cp

> Sources qui font foi (lire la partie utile) :
> `docs/design-system/README.md` (principes, couleur, typo, espacement, mouvement, icônes, a11y, correspondance Nuxt UI) ·
> `docs/design-system/patterns.md` (gabarits G1-G8 + patterns d'interaction) ·
> `docs/design-system/contenu.md` (voix, glossaire, messages types) · `docs/design-system/dataviz.md` (graphiques) ·
> `docs/design-system/tokens.json` / `tokens.css` · `docs/design-system/components/<Nom>/README.md` ·
> `docs/reference/07-ui-ux.md` (décisions, navigation définitive, studios) · `docs/maquettes.md` (écrans validés).
> Implémentation Nuxt → skill `cp-nuxt`.

## 1. Les 6 principes du produit
1. **Simple d'abord** — mode Simple par défaut ; le mode Technique (`ModeToggle`, mémorisé par utilisateur) AJOUTE identifiants, JSON, coûts, journaux. Jamais d'écran « technique seulement » si une version simple est possible.
2. **Une chose à la fois** — tâche longue = assistant pas à pas (G3, `Stepper`, brouillon auto). Jamais un formulaire de 20 champs.
3. **Toujours dire quoi faire ensuite** — vide, erreur, fin d'étape → une action claire.
4. **L'IA propose, l'humain dispose** — toute action réelle d'une IA s'affiche en clair avant (`ApprovalCard`) ; contenu généré marqué.
5. **Afrique d'abord** — mobile d'abord (chat, approbations, portefeuille, notifications), pages légères, hors ligne + reprise, FCFA sans décimales, français par défaut, anglais complet.
6. **Des patterns, pas des écrans uniques** — gabarit + composants du système. Besoin non couvert → d'abord ajouté au design system.

## 2. Principes universels (rappel)
Un point focal et UNE action `primary` par vue · hiérarchie par taille/poids/espace · Hick (moins de choix) · Fitts (cibles ≥ 44px mobile) · proximité · cohérence · feedback < 100 ms · prévention d'erreur (désactiver l'impossible, confirmer le destructif) · reconnaissance > rappel · accessibilité par défaut.

## 3. Choisir le gabarit AVANT de coder
| Gabarit | Pour |
|---|---|
| G1 Liste | agents, serveurs MCP, connecteurs, clés, runs, factures, membres, tables admin |
| G2 Détail | un agent, un serveur, un run, une organisation (onglets : Vue d'ensemble · Configuration · Activité · Réglages) |
| G3 Assistant | connecter un système, MCP Builder (5 étapes), Agent Studio (4 étapes), publication Marketplace, onboarding (3 étapes) |
| G4 Tableau de bord | accueil, consommation, admin Pilotage (3-4 `StatTile`, `CreditMeter`, ≤ 2 graphiques, liste « À faire ») |
| G5 Réglages | organisation, workspace, profil, facturation (zone dangereuse en dernier) |
| G6 Conversation | chat, agent conversationnel, copilote |
| G7 Éditeur visuel | cartographie MCP, enchaînement d'agent (Vue Flow) + vue liste équivalente |
| G8 Autorisation | consentement OAuth, CGU, approbation depuis un lien |

## 4. Couleur (tokens uniquement — jamais de hex)
- `canvas` fond · `surface` cartes/tableaux (+ `line` + `shadow-sm`) · `surface-sunken` barre latérale et code.
- `ink` / `ink-muted` texte ; `ink-disabled` seulement le désactivé.
- `primary` (#5B50C8 / sombre #A69FF2) = **agir** : bouton principal (1 par vue), liens, actif, sélection (`primary-soft`).
- `brand-violet` = identité : logo, illustrations, grands aplats — **jamais du texte ni un bouton**.
- `accent` corail = chaleur, avec parcimonie (Nouveau, astuces, onboarding) — **jamais une erreur** ; texte `on-accent`.
- `amber` = crédits et montants mis en avant (`amber-text` sur `amber-soft`) — pas un avertissement.
- Statuts réservés `success` / `warning` / `danger` / `info` (+ `*-soft`), **toujours icône + mot**.
- Focus : `focus-ring` 2px plein décalé de 2px, jamais supprimé. Clair ET sombre conçus (AA dans les deux).

## 5. Typo, espacement, formes
- Plus Jakarta Sans (titres) · Geist (interface) · Geist Mono (code, identifiants — surtout en Technique).
- `body` 16px en Simple, `body-sm` 14px en tableaux / Technique ; casse de phrase ; chiffres tabulaires.
- Grille 4px (`space-1`…`space-16`) ; carte `space-6` desktop / `space-4` mobile ; champs `space-5` ; sections `space-8`.
- `content-max` (listes, tableaux de bord) / `reading-max` (formulaires, assistants).
- Contrôles `control-md` 40px desktop, `control-lg` 48px mobile, `control-sm` 32px Technique seulement.
- `radius-md` boutons/champs · `radius-lg` cartes/dialogues · `radius-xl` encarts onboarding · `radius-pill` pastilles.
- Pas de dégradés, pas de verre dépoli, pas de bordure colorée à gauche des cartes.

## 6. Vocabulaire — glossaire D49 (obligatoire, via i18n)
| Simple (défaut) | Technique |
|---|---|
| Accès IA | Serveurs MCP |
| Systèmes connectés | Connecteurs |
| Action | Outil |
| Assistants | Agents |
| Fonctions IA | Capacités |
| Activité | Exécutions |
| Rapide / Équilibré / Expert | Flash / Smart / Max |
| Clés d'accès | Clés d'API |
| À valider | Approbations |
| Mode test | Environnements |
Profils d'onboarding (D41) : « J'utilise l'IA pour mon activité » · « Je crée des applications » · « Je déploie l'IA dans mon entreprise ». Le profil met en avant, il ne donne aucun droit.

## 7. Navigation définitive (ne rien inventer — détail 07-ui-ux)
- **Client** — haut : Accueil · Discuter · À valider · **Construire** : Accès IA · Systèmes connectés · Assistants · Fonctions IA · Marketplace · **Suivre** : Activité · Utilisation et coûts · **Développeurs** : Clés d'accès · Webhooks · Mode test · Documentation · **Organisation** : Équipe et rôles · Crédits et facturation · Budgets · Sécurité et audit · Réglages. (Libellés Technique selon le glossaire.)
- **Admin** — Pilotage · **Clients et revenus** : Clients · Finance · Tarification et plans · **IA** : Fournisseurs · Gateway et routage · IA de la plateforme (onglets Capacités internes · Garde-fous · Arrêts d'urgence · Modèles autorisés · Coûts) · **Produit** : API et clés · MCP et connecteurs · Agents · Marketplace · **Confiance** : Sécurité et abus · Conformité · Support · **Exploitation** : Système et incidents · Déploiement progressif · Contenu et traductions · Équipe interne et audit · Paramètres. Barre du haut admin : bouton « Arrêt d'urgence » permanent + minuteur de session.

## 8. États OBLIGATOIRES
| Type | États |
|---|---|
| Bouton | default · hover · focus-visible · active · disabled · loading (spinner dans le bouton seulement) |
| Champ | default · focus · rempli · erreur (message sous le champ, annoncé) · disabled |
| Donnée serveur | loading (`Skeleton`) · empty (`EmptyState` + action) · error (`Alert` + réessayer) · succès |
| Spécifiques project-cp | plan insuffisant (`PlanGate`) · crédits/budget épuisés (`CreditMeter` + recharger) · sandbox (bandeau « Mode test ») · approbation en attente · hors ligne (parcours mobiles) |

## 9. Patterns d'interaction clés
- Action risquée : faible → rien ; moyen → `ConfirmDialog` ; élevé/critique → `ConfirmDialog` avec résumé de l'effet et saisie du nom. Action IA à risque → `ApprovalCard` (paramètres corrigeables avant d'approuver).
- Secret affiché une fois (`SecretField`) : copier, avertissement, puis préfixe seul.
- Opération longue : `Timeline` en direct, on peut quitter, notification à la fin.
- Coût visible : estimation avant un essai (« ≈ 7 cr »), modèle utilisé affiché après (« Modèle utilisé : X (profil Équilibré) »).

## 10. Mouvement
150 ms survols/bascules, 200-250 ms tiroirs/dialogues, ease-out ; anime transform/opacity. Le mouvement explique un changement, jamais décoratif dans l'app. **Illustrations animées** uniquement accueil / auth / onboarding : formes de marque sans libellés, rythmes irréguliers, liens courbes, boucles ≥ 1,2 s, jamais derrière un champ, panneau fondu dans la page (D36/D38). `prefers-reduced-motion` → fondus seulement.

## 11. Icônes et contenu
Lucide (`@nuxt/icon`), trait 1,75, 16/20/24px ; icône + libellé (icône seule = actions universelles + `aria-label`). Aucun emoji. Référence : connecteur `plug`, serveur `server`, outil `wrench`, agent `bot`, capacité `sparkles`, run `play`, approbation `shield-check`, crédits `coins`, budget `gauge`, clé `key-round`, journal `scroll-text`.
Voix (`contenu.md`) : simple, direct, bienveillant ; **vouvoiement** (« Connectez votre boutique »), « you » neutre en anglais ; parler du résultat, pas de la technique ; boutons = verbe à l'infinitif + objet (jamais « OK » seul) ; pas de « ! » dans les erreurs, pas de culpabilisation ; montants « 4 900 FCFA », « 12 430 cr » ; dates relatives < 1 semaine.

## 12. Anti-patterns « interface d'IA » (bannis)
Tout en cartes · boutons fantômes partout · dégradés violet/rose, glassmorphism · skeleton pour 50 ms · modal pour une action inline · emojis · densité nulle · tout centré · placeholder = label · toast pour une erreur de formulaire · bordure colorée à gauche · deux boutons `primary` dans la même vue.

## 13. Checklist avant de livrer un écran
- [ ] Gabarit identifié, conforme à la maquette si elle existe
- [ ] Mode Simple compréhensible, mode Technique additif, glossaire respecté (FR + EN)
- [ ] Un seul `primary`, action suivante proposée
- [ ] Tous les états du §8
- [ ] AA clair + sombre, focus visible, clavier, cibles ≥ 44px mobile, statut = icône + mot
- [ ] Tokens partout, zéro valeur en dur, Lucide, pas d'emoji
- [ ] Mouvement conforme §10, `prefers-reduced-motion`
- [ ] Aucun anti-pattern §12
