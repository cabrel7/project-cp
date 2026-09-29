# Maquettes validées (Claude Design)

Références visuelles **validées** des écrans. Le code doit s'en approcher au plus près : les maquettes font foi pour la **composition** des écrans, le design system (`docs/design-system/`) pour les **tokens et composants**.

## Où sont les maquettes

| Quoi | Où | Usage |
|---|---|---|
| **Captures PNG** (43 écrans, résolution ×2) | `docs/maquettes/<page>/NN-Nom.png` | À regarder avant de coder un écran ; références de la régression visuelle (e2e) |
| **Sources HTML** des écrans | `docs/maquettes/source/*.dc.html` + `styles/` + `ds/` | Lire les valeurs exactes (textes, espacements, structure, exemples de données). Format Claude Design : `{{…}}` = variables, `<dc-import>` = composant réutilisé (ex. `NavApp`) |
| Index machine | `docs/maquettes/manifest.json` | Écran → fichier, titre, dimensions |
| Canevas vivant (privé) | https://claude.ai/artifact/RAb6kNKBERT4rJrASXKhV7 | Modifications de design ; **ré-exporter les captures** après tout changement |
| Design system (privé) | https://claude.ai/artifact/UFUhXtS31JR1sGteibuaMw | Source du dossier `docs/design-system/` |

Les agents travaillent avec les **captures et les sources du dépôt** (les liens claude.ai sont privés et inaccessibles en session cloud).


## 1 · Authentification

| Écran | Capture | Source | Taille |
|---|---|---|---|
| Connexion — desktop, clair | [`1-authentification/01-Main.png`](maquettes/1-authentification/01-Main.png) | `source/Main.dc.html` | 1280×860 |
| Inscription — desktop, clair | [`1-authentification/02-Inscription.png`](maquettes/1-authentification/02-Inscription.png) | `source/Inscription.dc.html` | 1280×860 |
| Vérification en deux étapes — desktop, sombre | [`1-authentification/03-DeuxEtapes.png`](maquettes/1-authentification/03-DeuxEtapes.png) | `source/DeuxEtapes.dc.html` | 1280×860 |
| Consentement OAuth (G8) — desktop, clair | [`1-authentification/04-Consentement.png`](maquettes/1-authentification/04-Consentement.png) | `source/Consentement.dc.html` | 1280×860 |
| Connexion par téléphone, erreur — mobile, sombre | [`1-authentification/05-ConnexionMobile.png`](maquettes/1-authentification/05-ConnexionMobile.png) | `source/ConnexionMobile.dc.html` | 390×844 |
| Code SMS — mobile, clair | [`1-authentification/06-CodeSms.png`](maquettes/1-authentification/06-CodeSms.png) | `source/CodeSms.dc.html` | 390×844 |
| Mot de passe oublié — mobile, clair | [`1-authentification/07-MotDePasseOublie.png`](maquettes/1-authentification/07-MotDePasseOublie.png) | `source/MotDePasseOublie.dc.html` | 390×844 |
| Nouveau mot de passe — mobile, clair | [`1-authentification/08-NouveauMotDePasse.png`](maquettes/1-authentification/08-NouveauMotDePasse.png) | `source/NouveauMotDePasse.dc.html` | 390×844 |
| Consentement OAuth (G8) — mobile, sombre | [`1-authentification/09-ConsentementMobile.png`](maquettes/1-authentification/09-ConsentementMobile.png) | `source/ConsentementMobile.dc.html` | 390×844 |
| Illustration animée de marque (composant réutilisé) | [`1-authentification/10-HeroSysteme.png`](maquettes/1-authentification/10-HeroSysteme.png) | `source/HeroSysteme.dc.html` | 424×440 |

## 2 · Onboarding par profil

| Écran | Capture | Source | Taille |
|---|---|---|---|
| 1. Choix du profil — desktop, clair | [`2-onboarding/11-OnbProfil.png`](maquettes/2-onboarding/11-OnbProfil.png) | `source/OnbProfil.dc.html` | 1280×860 |
| 2. Objectif — profil « activité », clair | [`2-onboarding/12-OnbObjectif.png`](maquettes/2-onboarding/12-OnbObjectif.png) | `source/OnbObjectif.dc.html` | 1280×860 |
| 3. Premier outil — profil « activité », clair | [`2-onboarding/13-OnbPremierOutil.png`](maquettes/2-onboarding/13-OnbPremierOutil.png) | `source/OnbPremierOutil.dc.html` | 1280×860 |
| Fin — espace prêt, mobile, clair | [`2-onboarding/14-OnbPretMobile.png`](maquettes/2-onboarding/14-OnbPretMobile.png) | `source/OnbPretMobile.dc.html` | 390×844 |
| 2. Choisir une capacité — profil « applications », clair | [`2-onboarding/15-OnbCapacite.png`](maquettes/2-onboarding/15-OnbCapacite.png) | `source/OnbCapacite.dc.html` | 1280×860 |
| 3. Brancher — onglet assistant de code, clair | [`2-onboarding/16-OnbCreateur.png`](maquettes/2-onboarding/16-OnbCreateur.png) | `source/OnbCreateur.dc.html` | 1280×860 |
| 3. Brancher — onglet SDK, mode Technique, sombre | [`2-onboarding/17-OnbDev.png`](maquettes/2-onboarding/17-OnbDev.png) | `source/OnbDev.dc.html` | 1280×860 |
| 2. Déployer dans l'entreprise — profil « entreprise », clair | [`2-onboarding/18-OnbEntreprise.png`](maquettes/2-onboarding/18-OnbEntreprise.png) | `source/OnbEntreprise.dc.html` | 1280×860 |
| 1. Choix du profil — mobile, sombre | [`2-onboarding/19-OnbProfilMobile.png`](maquettes/2-onboarding/19-OnbProfilMobile.png) | `source/OnbProfilMobile.dc.html` | 390×844 |

## 3 · Tableau de bord

| Écran | Capture | Source | Taille |
|---|---|---|---|
| Accueil — profil activité, mode Simple, clair | [`3-tableau-de-bord/20-DashActivite.png`](maquettes/3-tableau-de-bord/20-DashActivite.png) | `source/DashActivite.dc.html` | 1440×1000 |
| Accueil — profil applications, mode Technique, clair | [`3-tableau-de-bord/21-DashApps.png`](maquettes/3-tableau-de-bord/21-DashApps.png) | `source/DashApps.dc.html` | 1440×1000 |
| Accueil — profil entreprise, clair | [`3-tableau-de-bord/22-DashEntreprise.png`](maquettes/3-tableau-de-bord/22-DashEntreprise.png) | `source/DashEntreprise.dc.html` | 1440×1000 |
| Accueil mobile — profil activité, clair | [`3-tableau-de-bord/23-DashMobile.png`](maquettes/3-tableau-de-bord/23-DashMobile.png) | `source/DashMobile.dc.html` | 390×844 |

## 4 · Assistant MCP Builder

| Écran | Capture | Source | Taille |
|---|---|---|---|
| 1. Choisir le système — clair | [`4-mcp-builder/24-McpSource.png`](maquettes/4-mcp-builder/24-McpSource.png) | `source/McpSource.dc.html` | 1440×900 |
| 2. Connexion à une base de données — clair | [`4-mcp-builder/25-McpConnexion.png`](maquettes/4-mcp-builder/25-McpConnexion.png) | `source/McpConnexion.dc.html` | 1440×900 |
| 3. Actions — mode Simple, clair | [`4-mcp-builder/26-McpActions.png`](maquettes/4-mcp-builder/26-McpActions.png) | `source/McpActions.dc.html` | 1440×960 |
| 3. Outils — mode Technique, clair | [`4-mcp-builder/27-McpActionsTech.png`](maquettes/4-mcp-builder/27-McpActionsTech.png) | `source/McpActionsTech.dc.html` | 1440×960 |
| 4. Vérification — clair | [`4-mcp-builder/28-McpVerification.png`](maquettes/4-mcp-builder/28-McpVerification.png) | `source/McpVerification.dc.html` | 1440×900 |
| 5. Publié — clair | [`4-mcp-builder/29-McpPublie.png`](maquettes/4-mcp-builder/29-McpPublie.png) | `source/McpPublie.dc.html` | 1440×900 |

## 5 · Studios (Agent Studio, Prompt Studio)

| Écran | Capture | Source | Taille |
|---|---|---|---|
| Agent Studio · 1. Objectif (proposition de l'IA) — clair | [`5-studios/30-AgentObjectif.png`](maquettes/5-studios/30-AgentObjectif.png) | `source/AgentObjectif.dc.html` | 1440×1000 |
| Agent Studio · 2. Accès — clair | [`5-studios/31-AgentAcces.png`](maquettes/5-studios/31-AgentAcces.png) | `source/AgentAcces.dc.html` | 1440×1000 |
| Agent Studio · 3. Démarrage et règles — clair | [`5-studios/32-AgentRegles.png`](maquettes/5-studios/32-AgentRegles.png) | `source/AgentRegles.dc.html` | 1440×1000 |
| Agent Studio · 4. Essai sans effet — clair | [`5-studios/33-AgentEssai.png`](maquettes/5-studios/33-AgentEssai.png) | `source/AgentEssai.dc.html` | 1440×1000 |
| Agent Studio · configuration, mode Technique — sombre | [`5-studios/34-AgentStudio.png`](maquettes/5-studios/34-AgentStudio.png) | `source/AgentStudio.dc.html` | 1440×1000 |
| Agent Studio · exécution en attente d'accord — clair | [`5-studios/35-AgentRun.png`](maquettes/5-studios/35-AgentRun.png) | `source/AgentRun.dc.html` | 1440×1000 |
| Prompt Studio · éditeur de capacité — sombre | [`5-studios/36-PromptStudio.png`](maquettes/5-studios/36-PromptStudio.png) | `source/PromptStudio.dc.html` | 1440×1000 |
| Prompt Studio · évaluations et production — clair | [`5-studios/37-PromptEval.png`](maquettes/5-studios/37-PromptEval.png) | `source/PromptEval.dc.html` | 1440×1000 |

## 6 · Admin — IA de la plateforme

| Écran | Capture | Source | Taille |
|---|---|---|---|
| IA de la plateforme · capacités internes — clair | [`6-admin-ia/38-AdminIA.png`](maquettes/6-admin-ia/38-AdminIA.png) | `source/AdminIA.dc.html` | 1440×1000 |
| IA de la plateforme · mise en production bloquée par l'évaluation — sombre | [`6-admin-ia/39-AdminIAEdit.png`](maquettes/6-admin-ia/39-AdminIAEdit.png) | `source/AdminIAEdit.dc.html` | 1440×1000 |
| IA de la plateforme · garde-fous — clair | [`6-admin-ia/40-AdminGardeFous.png`](maquettes/6-admin-ia/40-AdminGardeFous.png) | `source/AdminGardeFous.dc.html` | 1440×1000 |
| Gateway et routage — sombre | [`6-admin-ia/41-AdminRoutage.png`](maquettes/6-admin-ia/41-AdminRoutage.png) | `source/AdminRoutage.dc.html` | 1440×1000 |

## 7 · Navigation définitive

| Écran | Capture | Source | Taille |
|---|---|---|---|
| Barre latérale de l'application (composant) | [`7-navigation/42-NavApp.png`](maquettes/7-navigation/42-NavApp.png) | `source/NavApp.dc.html` | 256×1000 |
| Barre latérale de l'administration (composant) | [`7-navigation/43-NavAdmin.png`](maquettes/7-navigation/43-NavAdmin.png) | `source/NavAdmin.dc.html` | 256×1000 |

## Règles d'usage pour les agents
- **Avant de coder un écran** : ouvrir la capture (outil Read sur le PNG) et la source HTML correspondantes ; choisir le gabarit (G1-G8) et les composants du design system ; ne rien inventer que la maquette ne montre pas (sinon : le signaler).
- **Fidélité** : mêmes textes (via i18n), même hiérarchie, mêmes états visibles ; les données d'exemple des maquettes servent de fixtures de test.
- **Implémentation** : les classes `cp-*` / `a-*` / `d-*` des sources sont une référence visuelle ; le code utilise Nuxt UI + le thème de `packages/ui` (skill `cp-ui-ux`, `cp-nuxt`), jamais ces classes directement.
- **Régression visuelle** (`cp-playwright`) : la première implémentation d'un écran est comparée à sa capture ; un écart de composition est signalé, jamais figé dans une baseline.
- **Thème** : chaque capture montre le thème prévu pour l'écran ; l'écran codé doit exister dans les deux thèmes.
- **Écart volontaire** (amélioration, contrainte technique) : proposé à Dylan, puis la maquette est mise à jour dans le canevas et les captures ré-exportées.

## Ré-exporter les captures
Après une modification du canevas : télécharger les fichiers `project/` du canevas, rendre chaque écran à sa taille (`canvas.json`) dans Chromium, ×2, et remplacer `docs/maquettes/<page>/`. Demander à Claude (session claude.ai) de le faire : il dispose de l'environnement d'exécution des maquettes.
