# Journal des décisions

> Source **unique** des décisions. Une décision = une ligne datée. On ne modifie jamais une ligne : une décision qui change est **remplacée** par une nouvelle ligne qui la cite (colonne « Remplace »).
> Statuts : ✅ validée · 🟡 provisoire (à confirmer) · ❌ abandonnée.

| # | Date | Sujet | Décision | Statut | Remplace |
|---|---|---|---|---|---|
| D01 | 2026-09-28 | Positionnement | Pas un « AI gateway de plus » : couche qui rend n'importe quel système compatible avec l'IA (connexion, modèles, agents, gouvernance) | ✅ | — |
| D02 | 2026-09-28 | Publics | Tous les profils (non-dev, vibe coder, dev, entreprise) sur un même moteur API-first ; MCP Builder pour tout le monde | ✅ | — |
| D03 | 2026-09-28 | Kòmerce | Banc d'essai et premier connecteur, pas une cible exclusive | ✅ | — |
| D04 | 2026-09-28 | Entité | Produit du Groupe ELS ; SARL au Cameroun, légalisation fin 2026 | ✅ | — |
| D05 | 2026-09-28 | Langues / devises | Bilingue FR/EN et multi-devises (XAF, XOF, EUR, USD) dès le départ | ✅ | — |
| D06 | 2026-09-28 | Stack | TypeScript de bout en bout : Hono (API) + Nuxt (front) ; monolithe modulaire ; pas de Laravel | ✅ | — |
| D07 | 2026-09-28 | Proxy LLM | LiteLLM (sans lien avec le projet llm-router) | ✅ | — |
| D08 | 2026-09-28 | Runtime MCP | Service unique multi-tenant piloté par configuration ; pas de code généré ni de Cloudflare Workers | ✅ | Idée v1 « un Worker par client » |
| D09 | 2026-09-28 | Accès aux modèles | Pas d'endpoint brut compatible OpenAI ; SDK + capacités `ai.run` (usage « power products » autorisé) | ✅ | — |
| D10 | 2026-09-28 | Rotation de comptes | Interdite (conditions fournisseurs) ; multi-sources légitimes (Anthropic, Bedrock, Vertex, Azure…) | ✅ | — |
| D11 | 2026-09-28 | Facturation | Abonnement + crédits (1 cr = 1 FCFA de valeur, non transférable) ; Run = métrique d'affichage ; prix des modèles dynamiques en base | ✅ | Quotas de Runs (v1) |
| D12 | 2026-09-28 | Crédits infra | Facturation de l'usage hors modèles (BYOK, mode A, agents, stockage, bridge) | 🟡 tarifs | — |
| D13 | 2026-09-28 | BYOK | Disponible sur tous les plans payants, variantes « infra seule » | ✅ | BYOK Pro seulement (v1) |
| D14 | 2026-09-28 | Offre Free | Modèles payants bon marché plafonnés, OTP par numéro (pas l'offre gratuite Gemini) | ✅ | Gemini gratuit (v1) |
| D15 | 2026-09-28 | Fonctions IA | Texte, outils, JSON, embeddings d'abord ; vision, audio, images, vidéo activées par feature flags | ✅ | — |
| D16 | 2026-09-28 | Hébergement | VPS-4 OVH (France) | ✅ | VPS-2 |
| D17 | 2026-09-28 | Erreurs / supervision | GlitchTip + Grafana/Prometheus/Loki/Tempo (gratuits) au lieu de Sentry | ✅ | Sentry (v1) |
| D18 | 2026-09-28 | Région de données | V1 en France ; région par organisation prévue dans le schéma ; région Afrique plus tard | ✅ | — |
| D19 | 2026-09-29 | Plans | Free, Starter, Pro, **Business**, Enterprise + variantes BYOK ; grille des droits validée | ✅ grille / 🟡 prix | — |
| D20 | 2026-09-29 | Prix | Starter 4 900 · Pro 19 900 · Business 49 900 · BYOK 2 900 / 12 900 / 34 900 (FCFA/mois) | 🟡 | — |
| D21 | 2026-09-29 | Nom | Provisoire `project-cp` (paramètre `brand.name`) ; SDK et domaine publiés seulement après le vrai nom | ✅ | AXON |
| D22 | 2026-09-29 | Base de données | PostgreSQL 18 + pgvector ; IDs hybrides bigint interne / UUIDv7 externe ; RLS + FK composites | ✅ | — |
| D23 | 2026-09-29 | Migrations / ORM | SQL versionné (dbmate) + Squawk ; Drizzle en lecture du schéma | ✅ | — |
| D24 | 2026-09-29 | Garde-fous | Pipeline 5 étapes, cascade du moins cher au plus cher, actions toujours soumises à des contrôles déterministes, profil Strict automatique, arrêts d'urgence | ✅ | — |
| D25 | 2026-09-29 | IA interne | Capacités de l'organisation système (id 0) gérées dans l'admin ; évaluation obligatoire avant production | ✅ | — |
| D26 | 2026-09-29 | Authentification | Briques (arctic, oslo, WebAuthn, argon2, jose) sur nos tables ; serveur OAuth 2.1 via oidc-provider (POC) | 🟡 POC | — |
| D27 | 2026-09-30 | Composants UI | **Nuxt UI** (spike P1.0 : 6/8 vs shadcn-vue 4/8 — moins de code, 22/27 composants natifs, intégration Nuxt native). Responsive mobile-first vérifié systématiquement | 🟡 | Shadcn (v1) |
| D28 | 2026-09-29 | Monorepo | pnpm + turborepo ; apps/ + packages/ + db/ ; Biome | ✅ | — |
| D29 | 2026-09-29 | UI/UX | Conventions et design system fixés dans Claude Design avant toute implémentation | ✅ | — |
| D30 | 2026-09-29 | Identité visuelle | Direction « Fusion A — Warm Tech » améliorée : crème, violet d'action #5B50C8, violet d'identité #7F77DD, corail #D85A30, ambre #BA7517 | ✅ | — |
| D31 | 2026-09-29 | Thèmes | Clair par défaut + sombre complet | ✅ | — |
| D32 | 2026-09-29 | Simplicité | Mode Simple par défaut, Technique en option ; philosophie ELS « simplifier la vie » | ✅ | — |
| D33 | 2026-09-29 | Méthode UI | Patterns réutilisables (8 gabarits, 27 composants) plutôt que tous les écrans ; design system = source de vérité | ✅ | — |
| D34 | 2026-09-29 | Typographie | Plus Jakarta Sans (titres), Geist (interface), Geist Mono (code) ; icônes Lucide | ✅ | — |
| D35 | 2026-09-29 | Connexion sociale | Google et Apple uniquement (pas GitHub, jugé intimidant pour les non-tech) ; plus e-mail + mot de passe, téléphone + code SMS, clé d'accès | ✅ | — |
| D36 | 2026-09-29 | Animations | Illustrations animées autorisées sur l'accueil, l'authentification et l'onboarding (ex. « système relié ») ; ailleurs, mouvement fonctionnel seulement ; `prefers-reduced-motion` toujours respecté | ✅ | — |
| D37 | 2026-09-29 | Message | Le discours couvre toute la plateforme (logiciels, modèles, agents, assistants, contrôle), pas seulement le MCP ; accroche de travail : « Rendez vos outils compatibles avec l'IA. » | 🟡 | — |
| D38 | 2026-09-29 | Message / auth | Accroche de travail : « Toute l'IA dont votre activité a besoin, au même endroit. » ; panneau d'authentification = formes de marque animées sans libellés, rythmes irréguliers, liens courbes, colonnes fondues (pas de séparateur) | 🟡 accroche / ✅ panneau | D37 (accroche) |
| D39 | 2026-09-29 | Onboarding | 3 étapes (Profil → Objectif ou Organisation → Premier pas) ; 4 profils (activité, créateur d'apps, développeur, entreprise) ; le profil ne bloque rien, il choisit le point de départ et le mode par défaut (Technique pour les développeurs) | ✅ | — |
| D40 | 2026-09-29 | Profils d'onboarding | 4 profils : « J'utilise des logiciels pour mon activité », « J'ajoute l'IA à mes applications » (capacités clé en main + clés utilisables dans ses outils, sans gérer l'intégration), « Je veux tout contrôler » (développeur : SDK, API, webhooks, MCP, agents), « Je déploie l'IA dans mon entreprise » | ✅ | Libellés de D39 |
| D41 | 2026-09-29 | Profils d'onboarding | **3 profils** : « J'utilise l'IA pour mon activité », « Je crée des applications » (développeurs et créateurs d'apps réunis : capacités prêtes, SDK, API, MCP, agents), « Je déploie l'IA dans mon entreprise ». Le profil ne donne aucun droit : les droits viennent du plan ; il change seulement ce qui est mis en avant (parcours, accueil, exemples). Mode Simple par défaut pour tous | ✅ | D40 |
| D42 | 2026-09-29 | Clés d'API | Une clé sert à appeler **nos** capacités (SDK, API, MCP) depuis les apps et outils du client ; une clé par app ou outil, avec ses limites ; jamais une clé de modèle brute (cf. D09) | ✅ | — |
| D43 | 2026-09-29 | Agents et capacités | Un agent peut appeler des capacités comme des outils (accord par version d'agent : autoriser / approbation / refuser) | ✅ | — |
| D44 | 2026-09-29 | Visibilité des capacités | Privée (workspace, défaut) · organisation · publique uniquement via la Marketplace | ✅ | — |
| D45 | 2026-09-29 | Routage | Résolution : modèle fixé > profil capacité/agent > défaut workspace > défaut organisation > défaut du plan ; filtrage (fonctions, contexte, région, BYOK prioritaire) ; bascule dans le même profil, jamais vers plus cher sans accord ; constance du modèle pendant un run ; traçabilité du choix | ✅ | — |
| D46 | 2026-09-29 | Modèle fixé | Autorisé dès le plan Pro ; indisponible ⇒ bascule vers le profil et signalement (option « échouer » en mode Technique) | ✅ | — |
| D47 | 2026-09-29 | Marketplace | Capacités vendables ; livraison scellée par défaut (prompt invisible et non modifiable), copie modifiable au choix de l'éditeur | ✅ | — |
| D48 | 2026-09-29 | Navigation | Barres latérales définitives de l'application et de l'admin (liste dans 07) ; une seule structure pour tous les profils, libellés selon le mode Simple/Technique, fonctions hors plan visibles avec invitation à changer de formule | ✅ | — |
| D49 | 2026-09-29 | Glossaire | Mode Simple : Accès IA, Systèmes connectés, Assistants, Fonctions IA, Activité, Rapide / Équilibré / Expert ; mode Technique : Serveurs MCP, Connecteurs, Agents, Capacités, Exécutions, Flash / Smart / Max | ✅ | — |
| D50 | 2026-09-29 | Plan de construction | Phases P0 à P10 (08) : socle → design system → identité → crédits → gateway IA et garde-fous → MCP Builder (**bêta privée**) → SDK et capacités → Agent Studio → exploitation (**bêta publique**) → Entreprise → Marketplace. Le socle IA précède le MCP Builder (dépendance technique) ; l'ouverture aux clients suit 01 §10 par feature flags | ✅ | — |
| D51 | 2026-09-29 | Stockage objet | Moteur S3 auto-hébergé = **SeaweedFS** (dev **et** production, sur notre serveur, gratuit) ; **OVH Object Storage** (≈ 0,014 €/Go/mois, trafic sortant gratuit) en option. MinIO abandonné (images communautaires arrêtées fin 2025). Le code ne voit que l'API S3 (`@aws-sdk/client-s3`) | ✅ | MinIO (03 v1) |
| D52 | 2026-09-29 | Backends de stockage | Plusieurs backends déclarés en base (`storage.backends`) ; **un seul reçoit les nouveaux fichiers par région**, choisi dans l'admin (Exploitation → Paramètres → Stockage) ; chaque fichier retient son backend (`storage.files.backend_id`) ; bascule sans interruption (les anciens fichiers restent lisibles) et **migration en tâche de fond** (copie → vérification sha256 → bascule → suppression de l'original), reprenable, motif obligatoire, auditée, super admin. Défaut au lancement : serveur local (SeaweedFS), alerte à 80 % du disque | ✅ | — |
| D53 | 2026-09-30 | i18n UI layer | Installer `@nuxtjs/i18n` dans `packages/ui` (layer Nuxt) pour P1.2 ; les apps mergent leurs propres clés par-dessus celles du layer | 🟡 | — |
| D54 | 2026-09-30 | Préfixe composants | Préfixe `Cp` pour tous les composants design system (`CpAlert`, `CpButton`…) ; Nuxt UI utilisé directement (`UButton`) quand le wrapper n'ajoute rien (configuration seule dans `app.config.ts`) | 🟡 | — |
| D55 | 2026-09-30 | Tests composants UI | Tests composants avec `@vue/test-utils` + `happy-dom` (pas `@nuxt/test-utils` — plus rapide, composables Nuxt mockés dans `setup.ts`) | 🟡 | — |
