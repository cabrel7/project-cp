---
name: cp-nuxt
description: Implémentation front de project-cp — Nuxt 4 (apps/web, apps/admin), Vue 3 script setup, Nuxt UI + Tailwind v4 (thème depuis les tokens, packages/ui), Pinia + Pinia Colada, client API généré @hey-api, i18n FR/EN, mode Simple/Technique, SSE, tests @nuxt/test-utils (apps) / @vue/test-utils (packages/ui). Design → cp-ui-ux.
---

# Nuxt 4 — project-cp

> Règles de design : `cp-ui-ux` (lire d'abord). Bibliothèques : `docs/reference/03-architecture-technique.md` §4.2.
> Le front n'appelle **que** l'API (jamais la base, jamais LiteLLM, jamais un secret).

## Structure (Nuxt 4, dossier `app/`)
```
apps/web/
  app/
    pages/            # routes (fichiers), minces : composent layout + composants
    layouts/          # default (AppShell + nav), auth (panneau illustré), bare (G8)
    components/       # composants métier (PascalCase, préfixés par domaine : AgentRunTimeline.vue)
    composables/      # use<Domaine>() : requêtes, mutations, logique d'écran
    stores/           # Pinia (état UI global : org/workspace courants, mode Simple/Technique)
    middleware/       # auth.global.ts, plan-gate.ts
    plugins/          # api.ts (client @hey-api configuré), i18n, erreurs
    utils/            # formatCredits, formatFcfa, dates
  i18n/locales/{fr,en}.json
  e2e/                # Playwright (voir cp-playwright)
  nuxt.config.ts
packages/ui/          # thème Nuxt UI + composants du design system partagés web/admin (layer Nuxt)
```
`packages/ui` est un **layer Nuxt** (`extends: ['@cp/ui']`) : tokens, `app.config.ts` Nuxt UI, composants `Cp*` partagés.

## Thème : tokens → Tailwind v4 → Nuxt UI
- `packages/ui/assets/css/main.css` : `@import "tailwindcss"; @import "@nuxt/ui";` puis `@theme` qui reprend
  `docs/design-system/tokens.css` (variables `--cp-*`) ; sombre via `.dark { … }`.
- `app.config.ts` : `ui.colors = { primary: 'primary', secondary: 'accent', neutral: 'ink', success, warning, error: 'danger', info }` ;
  surcharges `ui.button`, `ui.input`… pour reproduire les rendus `cp-*` de `docs/design-system/components/bundle.css`.
- Jamais de couleur/taille en dur dans un composant : classes du thème (`bg-(--cp-surface)`, `text-(--cp-ink-muted)`) ou props Nuxt UI (`color="primary"`).
- Polices auto-hébergées via `@fontsource` importées dans `packages/ui/assets/css/theme.css` (Plus Jakarta Sans, Geist, Geist Mono — D56 ; jamais `@nuxt/fonts` ni Google Fonts) ; icônes `@nuxt/icon` collection `lucide` (`i-lucide-bot`).

## Composants
- `<script setup lang="ts">` toujours ; `defineProps<{…}>()`, `defineEmits<{…}>()`, `defineModel()` ; pas d'Options API.
- Composant > 200 lignes → découper ; logique → composable ; `v-for` avec `:key` stable (public_id).
- Réutiliser d'abord Nuxt UI (`UButton`, `UInput`, `UTable`, `UModal`, `UTabs`, `UStepper`…) configurés, puis les `Cp*` de `packages/ui`
  (`CpApprovalCard`, `CpCreditMeter`, `CpPlanGate`, `CpRiskTag`, `CpSecretField`, `CpStatusBadge`, `CpModeToggle`…).

## Données : client généré + Pinia Colada
- Le client TS est généré depuis l'OpenAPI de l'API : `pnpm --filter @cp/api openapi:emit && pnpm --filter web api:gen`
  (`@hey-api/openapi-ts` → `app/api/generated/`, jamais modifié à la main).
- Chaque domaine a son composable :
```ts
// app/composables/useAgents.ts
export function useAgents(filters: MaybeRefOrGetter<AgentFilters>) {
  const api = useApi()
  return useQuery({
    key: () => ['agents', useOrgStore().workspaceId, toValue(filters)],
    query: () => api.agents.list({ query: toValue(filters) }),
  })
}
export function useCreateAgent() {
  const api = useApi(); const cache = useQueryCache()
  return useMutation({
    mutation: (body: CreateAgentBody) => api.agents.create({ body, headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    onSettled: () => cache.invalidateQueries({ key: ['agents'] }),
  })
}
```
- Erreurs API : format `{ error: { code, message, details, request_id } }` → `useApiError()` mappe le `code` vers un message i18n
  (`errors.<CODE>`), affiche `request_id` en mode Technique. `PLATFORM_FEATURE_NOT_AVAILABLE` → `PlanGate` ; crédits → CTA recharger.
- Temps réel (runs, notifications) : SSE via `useEventSource` (@vueuse) sur `/v1/…/stream`, reconnexion avec `Last-Event-ID`.

## Pages : états obligatoires
```vue
<script setup lang="ts">
const { t } = useI18n()
const filters = ref<AgentFilters>({})
const { data, status, error, refetch } = useAgents(filters)
</script>
<template>
  <CpPageHeader :title="t('nav.assistants')" :description="t('agents.list.hint')">
    <template #actions><UButton :to="'/assistants/nouveau'" :label="t('agents.create')" icon="i-lucide-plus" /></template>
  </CpPageHeader>
  <CpSkeletonRows v-if="status === 'pending'" />
  <UAlert v-else-if="error" color="error" :title="t('common.loadError')" :actions="[{ label: t('common.retry'), onClick: () => refetch() }]" />
  <CpEmptyState v-else-if="!data?.items.length" icon="i-lucide-bot" :title="t('agents.empty.title')" :action="t('agents.create')" to="/assistants/nouveau" />
  <AgentTable v-else :rows="data.items" />
</template>
```

## Mode Simple / Technique et glossaire
- Store `useUiModeStore()` (`mode: 'simple' | 'technical'`, persisté côté serveur dans les préférences utilisateur).
- Libellés : `t(\`glossary.${mode}.agents\`)` — une clé par terme du glossaire D49 ; jamais de libellé métier en dur.
- En Technique : colonnes/sections supplémentaires (`v-if="isTechnical"`), jamais de suppression d'information du mode Simple.

## i18n
`@nuxtjs/i18n`, stratégie `prefix_except_default` (fr par défaut), `lazy: true`. Toute chaîne visible passe par `t()`.
Nombres : `formatFcfa(n)` (0 décimale), `formatCredits(microCredits: string)` (µcr reçus en **string**, convertis en BigInt).
Dates : `useDateFormat` + fuseau de l'organisation.

## Sécurité front
`nuxt-security` (CSP stricte, pas d'inline non hashé) ; `runtimeConfig.public` ne contient aucun secret ; `v-html` interdit sauf
contenu Markdown passé par `@nuxtjs/mdc` ; jetons de session en cookie HttpOnly (géré par l'API), jamais en localStorage.

## Admin (`apps/admin`)
Même layer `@cp/ui`, navigation admin définitive (cp-ui-ux §7), mode Technique par défaut, bouton Arrêt d'urgence permanent,
toute action sensible → `ConfirmDialog` avec motif obligatoire (audité côté API).

## Tests
Apps (`apps/web`, `apps/admin`) : `@nuxt/test-utils` + Vitest (`environment: 'nuxt'`) : `mountSuspended(Component)` ; `packages/ui` : `@vue/test-utils` + `happy-dom`, auto-imports Nuxt mockés dans `tests/setup.ts` (D55) ; catalogue = pages de `packages/ui/tests/e2e/fixture` + Playwright (D57) ; MSW pour l'API ; tester loading / empty / error / succès,
et le mode Technique. E2E → `cp-playwright`.

## Anti-patterns interdits
Options API · `$fetch`/`useFetch` dans un composant · client API écrit à la main · `any` · couleur/taille en dur · texte en dur ·
`v-html` brut · secret dans `public` · `localStorage` pour l'auth · store qui duplique le cache Colada · `v-for` avec index en key.
