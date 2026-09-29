# Maquettes et design system (Claude Design)

Références visuelles **validées**. Le code doit s'en approcher au plus près ; en cas d'écart, le design system (`docs/design-system/`) fait foi pour les tokens et les composants, les maquettes pour la composition des écrans.

| Élément | Lien (privé — partager depuis le menu Share si besoin) |
|---|---|
| Design system « project-cp » | https://claude.ai/artifact/UFUhXtS31JR1sGteibuaMw |
| Canevas « project-cp — Maquettes de validation » | https://claude.ai/artifact/RAb6kNKBERT4rJrASXKhV7 |

## Pages du canevas
1. **Authentification** : connexion (desktop/mobile), inscription, code SMS, 2FA, mot de passe oublié / nouveau, consentement OAuth (G8), illustration animée de marque.
2. **Onboarding par profil** : choix du profil (3 profils), objectif, premier outil, capacité, branchement (assistant de code / SDK), entreprise, fin mobile.
3. **Tableau de bord** : profils activité (Simple), applications (Technique, sombre), entreprise, mobile.
4. **MCP Builder** : système, connexion base de données, actions (Simple), outils (Technique), vérification, publication.
5. **Studios** : Agent Studio (4 étapes + fiche + exécution) et Prompt Studio (éditeur + évaluations).
6. **Admin — IA de la plateforme** : capacités internes, mise en production bloquée par l'évaluation, garde-fous, gateway et routage.
7. **Navigation définitive** : barres latérales application et administration (liste dans `docs/reference/07-ui-ux.md`).

## Règles d'usage pour les agents
- Captures de référence pour la régression visuelle : `apps/web/e2e/__screens__/reference/` (à exporter depuis le canevas lors de la phase UI).
- Les classes `cp-*` de `docs/design-system/components/bundle.css` sont une **référence visuelle** : l'implémentation réelle utilise Nuxt UI configuré pour reproduire ces rendus (voir skill `cp-ui-ux`).
