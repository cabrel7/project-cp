---
name: cp-playwright
description: E2E et régression visuelle de project-cp avec Playwright — Chromium préinstallé (jamais playwright install), Page Objects, sélecteurs sémantiques i18n, organisations de test isolées, captures clair/sombre/mobile comparées aux maquettes, vidéo pour le débogage (avec cp-ffmpeg), parcours critiques du produit.
---

# Playwright — project-cp

## Environnement
- Cloud : `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` (posé par le hook SessionStart). Local : cache `~/.cache/ms-playwright`.
- **Ne jamais lancer `playwright install`.** Si la version de `@playwright/test` du projet ne correspond pas au Chromium préinstallé :
  `launchOptions: { executablePath: '/opt/pw-browsers/chromium' }` (chemin exact via `ls /opt/pw-browsers`).
- `apps/web/playwright.config.ts` : `webServer` (build + preview Nuxt, API sur une base de test), `baseURL`, `locale: 'fr-FR'`,
  `timezoneId: 'Africa/Douala'`, `video: 'retain-on-failure'`, `trace: 'retain-on-failure'`, projets `desktop-light`, `desktop-dark`
  (`colorScheme: 'dark'`), `mobile` (390×844, `isMobile`, `hasTouch`).

## Structure
```
apps/web/e2e/
  pages/            # Page Objects (1 par écran) : LoginPage, OnboardingPage, McpBuilderPage, AgentStudioPage, ApprovalsPage…
  fixtures.ts       # test.extend : org isolée par test (API de seed de test), utilisateur connecté (storageState), mode Simple/Technique
  specs/            # *.spec.ts par parcours
  __screens__/      # baselines Playwright (générées) — les maquettes validées sont dans docs/maquettes/<page>/*.png
```

## Sélecteurs
`getByRole('button', { name: 'Créer un assistant' })` > `getByLabel` > `getByText` > `getByTestId` (dernier recours, éléments dynamiques).
Les noms viennent de l'i18n FR (défaut) : importer `fr.json` pour éviter les chaînes dupliquées. Jamais de sélecteur CSS/XPath.

## Attentes
Auto-retry uniquement (`await expect(locator).toBeVisible()`, `toHaveURL`) ; **aucun** `waitForTimeout`. Réseau externe bloqué
(`page.route('**/*', …)` sur les domaines tiers) ; LiteLLM simulé côté API de test.

## Régression visuelle
```ts
await expect(page).toHaveScreenshot('assistants-liste.png', {
  maxDiffPixelRatio: 0.01, animations: 'disabled',
  mask: [page.getByTestId('relative-time'), page.getByTestId('credit-balance')],
})
```
Chaque écran clé : clair + sombre + mobile. Comparer aussi à la capture validée (`docs/maquettes/<page>/NN-Nom.png`, index `docs/maquettes.md`) lors de la première implémentation :
écart de composition = signalé (pas de baseline « acceptée » qui fige un écart).
Illustrations animées (auth, onboarding) : `animations: 'disabled'` + test séparé `prefers-reduced-motion` (`page.emulateMedia({ reducedMotion: 'reduce' })`).

## Parcours critiques project-cp
1. Inscription e-mail / téléphone + OTP (valide, expiré, trop d'essais) → onboarding 3 étapes selon chacun des 3 profils → tableau de bord.
2. Connexion Google/Apple (fournisseur simulé), 2FA, mot de passe oublié.
3. MCP Builder : Système → Connexion (erreur de connexion) → Actions → Vérification (échec puis succès) → Publication → jeton affiché une fois.
4. Agent Studio : 4 étapes → essai sans effet (coût estimé affiché) → activation → run avec **approbation** (corriger un paramètre, approuver ; refuser ; expirer).
5. Crédits : solde bas (alerte), épuisé (refus + CTA recharger), plan insuffisant (`PlanGate`).
6. Consentement OAuth (G8) : autoriser / refuser.
7. Mode Simple ↔ Technique : mêmes données, libellés du glossaire, colonnes techniques en plus.
8. Admin : arrêt d'urgence (motif obligatoire), mise en production d'une capacité interne bloquée sous le seuil.

## Exécution
```bash
pnpm --filter web exec playwright test                          # tout
pnpm --filter web exec playwright test specs/agent-studio.spec.ts --project=desktop-light
pnpm --filter web exec playwright test --update-snapshots       # seulement après un changement VOULU et validé
pnpm --filter web exec playwright show-report
```
Débogage d'un échec visuel/animation : vidéo dans `test-results/` → `cp-ffmpeg` (extraction de frames) → lire les PNG.

## Règles
Un test = un parcours, indépendant, sa propre organisation ; nettoyage par l'API de test ; pas d'ordre implicite ; sortie brute collée dans le livrable.
