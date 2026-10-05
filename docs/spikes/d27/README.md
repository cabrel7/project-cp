# Spike D27 — Nuxt UI vs shadcn-vue

**Date :** 2026-09-30 · **Statut :** VERDICT PROPOSÉ · **Lot :** P1.0

## Contexte

D27 prévoit Nuxt UI par défaut, « à confirmer contre shadcn-vue pendant le travail UI/UX ».
Ce spike implémente 3 composants témoins (Button, DataTable, Stepper) avec les tokens du design system project-cp, en mode clair et sombre, pour évaluer les deux options.

## Composants testés

| Composant | Design system | Nuxt UI | shadcn-vue |
|-----------|---------------|---------|------------|
| **Button** | 4 variantes (primary, secondary, ghost, danger), 3 tailles, loading, disabled | `<UButton>` thémé via `app.config.ts` | `<Button>` copié + `cva` (class-variance-authority) |
| **DataTable** | En-tête surface-sunken, tri, StatusBadge, montants tabulaires, pagination curseur, carte mobile | `<UTable>` + slots par colonne + `<UPagination>` | `@tanstack/vue-table` + 6 primitifs Table* manuels |
| **Stepper** | 3-5 étapes, pastilles done/current/pending, retour arrière, mobile « Étape 2 sur 4 » | `<UStepper>` + thème | Composant maison (~45 lignes) |

## Critères d'évaluation

### 1. Fidélité au design system

Les deux approches produisent un rendu **identique** avec nos tokens CSS (voir `captures/`).
La différence est dans le mécanisme :

- **Nuxt UI** : tokens mappés dans `app.config.ts` via classes Tailwind arbitraires (`bg-[var(--primary)]`). Un seul fichier de configuration centralise tout le thème.
- **shadcn-vue** : tokens mappés directement dans chaque composant via `cva` ou classes Tailwind. Pas de fichier de thème centralisé.

**Avantage : Nuxt UI** — un seul point de contrôle pour le thème global.

### 2. Quantité de code (DX)

| Composant | Nuxt UI (lignes de template) | shadcn-vue (lignes de template) |
|-----------|------------------------------|--------------------------------|
| Button | ~10 (wrapper mince) | ~20 (composant complet copié) |
| DataTable | ~25 (UTable + slots) | ~65 (TanStack + 6 primitifs) |
| Stepper | ~15 (UStepper) | ~45 (composant maison) |
| **Total** | **~50** | **~130** |

**Avantage : Nuxt UI** — 2,6× moins de code pour le même résultat.

### 3. Composants fournis vs à construire

| Composant project-cp | Nuxt UI v4 | shadcn-vue |
|----------------------|------------|------------|
| Button | ✅ UButton | ✅ Button |
| DataTable | ✅ UTable | ⚠️ TanStack Table (boilerplate) |
| Stepper | ✅ UStepper | ❌ Pas de composant stable |
| Select | ✅ USelect | ✅ Select |
| Switch | ✅ USwitch | ✅ Switch |
| Tabs | ✅ UTabs | ✅ Tabs |
| Toast | ✅ UToast | ✅ Toast (via sonner) |
| Dialog | ✅ UModal | ✅ Dialog |
| AppShell / Navigation | ✅ UNavigationMenu, UDashboard* | ❌ À construire |
| CommandPalette | ✅ UCommandPalette | ✅ Command |
| Pagination | ✅ UPagination | ✅ Pagination |
| Skeleton | ✅ USkeleton | ✅ Skeleton |

Sur les 27 composants du design system, Nuxt UI v4 en couvre **~22** nativement. shadcn-vue en couvre **~15**, le reste étant à construire manuellement.

**Avantage : Nuxt UI** — moins de composants maison à maintenir.

### 4. Accessibilité

- **Nuxt UI** : basé sur Reka UI (ex-Radix Vue), a11y intégrée (ARIA, focus trap, keyboard nav).
- **shadcn-vue** : basé sur Radix Vue également, même socle a11y pour les composants disponibles. Mais les composants maison (Stepper, DataTable) doivent implémenter l'a11y manuellement.

**Avantage : Nuxt UI** — a11y garantie sur plus de composants.

### 5. Mise à jour et maintenance

- **Nuxt UI** : `pnpm update @nuxt/ui` — mises à jour centralisées, risque de breaking changes entre majeures (v3→v4 a été significatif).
- **shadcn-vue** : copier-coller initial, pas de `npm update` — les composants sont dans le projet. Mises à jour manuelles.

**Trade-off** : Nuxt UI est plus simple à maintenir au quotidien mais plus risqué lors des majeures. shadcn-vue est stable mais demande plus de maintenance quotidienne.

### 6. Intégration Nuxt 4

- **Nuxt UI** : module Nuxt natif, auto-imports, SSR, layer support, dark mode via `useColorMode`.
- **shadcn-vue** : nécessite configuration manuelle (Tailwind, auto-imports, SSR vérification par composant).

**Avantage : Nuxt UI** — intégration zéro-config avec notre stack.

### 7. Taille du bundle

- **Nuxt UI** : tree-shaking par composant, mais le module entier ajoute ~15-20 kB gzippé de base.
- **shadcn-vue** : uniquement les composants importés, pas de surcoût de framework.

**Avantage : shadcn-vue** — bundle légèrement plus léger.

## Captures

| | Clair | Sombre | Mobile |
|---|---|---|---|
| Nuxt UI | `captures/nuxt-ui-light.png` | `captures/nuxt-ui-dark.png` | `captures/nuxt-ui-mobile.png` |
| shadcn-vue | `captures/shadcn-vue-light.png` | `captures/shadcn-vue-dark.png` | `captures/shadcn-vue-mobile.png` |

## Résumé

| Critère | Nuxt UI | shadcn-vue |
|---------|---------|------------|
| Fidélité tokens | ✅ Centralisé | ✅ Direct |
| Volume de code | ✅ ~50 lignes | ❌ ~130 lignes |
| Couverture composants | ✅ 22/27 | ⚠️ 15/27 |
| Accessibilité | ✅ Intégrée | ⚠️ Partielle |
| Intégration Nuxt | ✅ Native | ⚠️ Manuelle |
| Taille bundle | ⚠️ +15 kB | ✅ Minimal |
| Contrôle markup | ⚠️ Via slots | ✅ Total |
| Risque majeure | ⚠️ Breaking changes | ✅ Stable (copié) |

**Score : Nuxt UI 6/8 — shadcn-vue 4/8**

## Verdict PROPOSÉ

**Nuxt UI** est recommandé pour project-cp.

**Justification :**
1. Le gain de productivité est décisif : 2,6× moins de code par composant, 22/27 composants couverts nativement.
2. L'intégration Nuxt native élimine la configuration manuelle (dark mode, SSR, auto-imports).
3. Le risque de breaking changes sur les majeures est atténué par le fait que nous serons sur Nuxt UI v4 (stable, sorti mi-2025) pour toute la durée du développement initial.
4. Le surcoût bundle de ~15 kB est négligeable pour une application SaaS.
5. Les 5 composants non couverts (CreditMeter, RiskTag, ApprovalCard, ChatMessage, CodeBlock) sont spécifiques à project-cp et seraient des composants maison dans les deux cas.

**Condition :** si la configuration du thème via `app.config.ts` s'avère trop limitée lors de P1.1 (tokens.json → Tailwind v4 `@theme`), la décision peut être révisée avant P1.2.

---

*Ce verdict est PROPOSÉ. Il ne sera marqué ✅ dans `docs/reference/06-journal-decisions.md` qu'après validation humaine.*
