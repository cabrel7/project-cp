# E2E design system (`@cp/ui`)

Fixture Nuxt minimale (`fixture/`) + Playwright. Lancer : `pnpm --filter @cp/ui test:e2e`.

## Deux jeux de références visuelles
- `__screens__/<spec>/<projet>/` : jeu local (Chromium préinstallé de la session, comparé à `docs/review/fidelite-1.png`).
- `__screens__/<spec>/<projet>-ci/` : jeu CI (utilisé quand `CI` est défini), rendu avec le Chromium de Playwright.

Régénérer le jeu CI : Actions > « Update E2E snapshots » > Run workflow sur la branche de la PR (refusé sur `main`/`dev`).
Le workflow génère, revérifie sans `--update-snapshots`, commite puis pousse. Le push par `GITHUB_TOKEN` ne déclenche pas
la CI : la relancer (push d'un commit vide par un humain, ou fermer/rouvrir la PR). Ne jamais relâcher `maxDiffPixelRatio`.
