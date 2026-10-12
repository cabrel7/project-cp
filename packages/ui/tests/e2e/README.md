# E2E design system (`@cp/ui`)

Fixture Nuxt minimale (`fixture/`) + Playwright. Lancer : `pnpm --filter @cp/ui test:e2e`.

## Deux jeux de références visuelles
- `__screens__/<spec>/<projet>/` : jeu local (Chromium préinstallé de la session, comparé à `docs/review/fidelite-1.png`).
- `__screens__/<spec>/<projet>-ci/` : jeu CI (utilisé quand `CI` est défini), rendu avec le Chromium de Playwright.

Régénérer le jeu CI : modifier la ligne `demande:` de `.regenerate-ci-snapshots` et pousser (workflow `update-e2e-snapshots`, ignoré sur `main`/`dev`). `workflow_dispatch` n'est disponible qu'une fois le workflow sur la branche par défaut.
Le workflow génère, revérifie sans `--update-snapshots`, commite puis pousse. Le push par `GITHUB_TOKEN` ne déclenche pas
la CI : la relancer (pousser un commit normal sur la branche, ou « Re-run all jobs » sur la PR). Ne jamais relâcher `maxDiffPixelRatio`.
