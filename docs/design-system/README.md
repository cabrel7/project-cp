La plateforme rend n'importe quel système compatible avec l'IA, pour tout le monde. Le design suit la philosophie du Groupe ELS : **simplifier la vie**. Chaque écran doit pouvoir être utilisé par un commerçant qui n'a jamais entendu parler d'API, sans gêner le développeur qui veut tout contrôler.

> Nom provisoire : **project-cp**. Le nom et le logo définitifs remplaceront le nom de code sans changer le reste du système.

## Principes

1. **Simple d'abord.** Le mode **Simple** est le défaut : langage courant, une action principale par écran, détails techniques cachés. Le mode **Technique** (interrupteur `ModeToggle`, mémorisé par utilisateur) révèle identifiants, JSON, journaux et réglages avancés. On ne crée jamais un écran « technique seulement » quand une version simple est possible.
2. **Une chose à la fois.** Les tâches longues (connecter un système, créer un agent) passent par un assistant pas à pas (`Stepper`), avec sauvegarde automatique du brouillon. Jamais un formulaire de 20 champs.
3. **Toujours dire quoi faire ensuite.** Un écran vide, une erreur ou une fin d'étape propose une action claire (`EmptyState`, `Alert` avec bouton).
4. **L'IA propose, l'humain dispose.** Tout ce qu'une IA va faire de réel s'affiche en clair avant d'agir (`ApprovalCard`). Le contenu généré par l'IA est marqué comme tel.
5. **Pensé pour l'Afrique d'abord.** Mobile d'abord pour les parcours du quotidien (chat, approbations, portefeuille), pages légères, tolérance aux coupures (états hors ligne et reprise), montants en FCFA sans décimales, français par défaut, anglais complet.
6. **Des patterns, pas des écrans uniques.** Tout nouvel écran est assemblé à partir des gabarits de la section *Patterns* et des composants de ce système. Un besoin qui n'y entre pas se discute et s'ajoute au système avant d'être codé.

## Couleur

- **Fond de page `canvas`** (crème chaud en clair, violet nuit en sombre) ; cartes et tableaux sur **`surface`** avec une bordure `line` et `shadow-sm` ; barre latérale et zones de code sur `surface-sunken`.
- **Texte : `ink`** pour le principal, **`ink-muted`** pour le secondaire, sur toutes les surfaces et tous les `*-soft`. `ink-disabled` seulement pour le désactivé.
- **`primary` (violet) = agir.** Bouton principal (une seule fois par vue), liens, élément actif, sélection (`primary-soft` en fond). Texte sur un fond primary : `on-primary`.
- **`brand-violet` = identité**, jamais pour du texte ni un bouton : logo, illustrations, grands aplats.
- **`accent` (corail) = chaleur**, avec parcimonie : badge « Nouveau », encarts d'onboarding et d'astuces (`accent-soft` + `ink`), illustrations. Texte sur un fond accent : `on-accent` (jamais du blanc). **Le corail n'est jamais une erreur.**
- **`amber` = crédits et points forts** : le portefeuille et les montants de crédits mis en avant (`amber-text` sur `amber-soft`). Ce n'est pas un statut d'avertissement.
- **Statuts réservés :** `success`, `warning`, `danger`, `info`, chacun avec son `*-soft`. Un statut porte **toujours une icône et un mot**, jamais la couleur seule. `danger` est plus sombre et plus rouge que le corail pour ne jamais être confondu.
- **Focus clavier :** anneau `focus-ring` de 2px plein, décalé de 2px, sur tout élément interactif. Jamais supprimé.
- **Thèmes :** clair par défaut, sombre disponible et suivi du réglage système. Les deux thèmes sont conçus, pas inversés : chaque couleur a sa valeur sombre dans `tokens.json`. Tous les couples texte/fond atteignent 4,5:1 dans les deux thèmes ; bordures de contrôles (`line-strong`) et anneau de focus ≥ 3:1.

## Typographie

- **Titres : Plus Jakarta Sans** (`display`, `heading-1` à `heading-3`), chaleureuse et lisible.
- **Interface et texte : Geist** (`body-lg`, `body`, `body-sm`, `label`, `caption`, `kpi`).
- **Code, identifiants, JSON : Geist Mono** (`code`, `code-sm`), uniquement en mode Technique ou dans les zones de code.
- `body` (16px) est la taille par défaut en mode Simple ; `body-sm` (14px) pour les tableaux et le mode Technique dense.
- Casse de phrase partout (« Créer un agent », pas « Créer Un Agent ») ; majuscules seulement dans `caption` des badges.
- Chiffres tabulaires (`font-variant-numeric: tabular-nums`) dans les tableaux, compteurs et `kpi`.
- Polices auto-hébergées via `@fontsource` (Geist, Geist Mono, Plus Jakarta Sans — D56), importées par `packages/ui` ; repli système défini dans les familles. (`components/bundle.css` garde l'import Google Fonts : référence visuelle seulement, jamais chargé par l'app.)

## Espacement et mise en page

- Grille de 4px : `space-1` à `space-16`. Padding des cartes `space-6` (desktop) / `space-4` (mobile) ; écart entre champs `space-5` ; entre sections `space-8`.
- Contenu limité à `content-max` (listes, tableaux de bord) ou `reading-max` (formulaires, assistants, textes).
- **App shell :** barre latérale `sidebar` (256px) sur `surface-sunken` ≥ `bp-md` ; tiroir en dessous. Barre du haut avec sélecteur d'organisation/workspace, recherche, crédits, notifications, `ModeToggle`, profil.
- **Mobile d'abord** pour chat, approbations, portefeuille, notifications : contrôles `control-lg` (48px), une colonne, actions principales en bas d'écran.
- Desktop : contrôles `control-md` (40px) ; `control-sm` (32px) seulement en mode Technique.

## Formes et élévation

- `radius-md` pour boutons et champs, `radius-lg` pour cartes, tableaux et dialogues, `radius-xl` pour les grands encarts d'onboarding, `radius-pill` pour interrupteurs, jauges et pastilles.
- Élévation sobre : bordure `line` + `shadow-sm` au repos ; `shadow-md` pour menus et survol ; `shadow-lg` pour dialogues et tiroirs, sur un voile `scrim`.
- Pas de dégradés, pas de verre dépoli, pas de bordure colorée à gauche des cartes.

## Mouvement

- Court et utile : 150 ms pour les survols et bascules, 200–250 ms pour les tiroirs et dialogues, courbe « ease-out ».
- Le mouvement explique un changement (un panneau qui arrive d'un côté, une ligne qui apparaît dans une timeline) ; jamais décoratif dans l'application.
- **Illustrations animées** : permises seulement sur l'accueil, l'authentification et l'onboarding, avec les formes de la marque (dalle `brand-violet`, carré `accent`, teinte `primary-soft`, pastille `amber`, nœuds reliés au hub `primary`), sans libellés. Rythmes volontairement irréguliers (durées, sens et amplitudes différents), liens courbes, déplacements de quelques pixels ; boucles lentes (≥ 1,2 s), jamais derrière un champ de saisie. Le panneau se fond dans la page (même fond `canvas`, pas de séparateur).
- Respect de `prefers-reduced-motion` : fondus seulement.
- Chargement : squelettes (`Skeleton`) plutôt que des spinners plein écran ; un spinner seulement dans un bouton en cours.

## Iconographie

- **Lucide** (via `@nuxt/icon`, collection `lucide`), trait 1,75px, tailles 16 / 20 / 24px, couleur héritée du texte.
- Une icône accompagne un libellé ; icône seule uniquement pour les actions universelles (fermer, menu, copier, rechercher) avec une étiquette accessible.
- Pas d'emoji dans l'interface.
- Icônes de référence : connecteur `plug`, serveur MCP `server`, outil `wrench`, agent `bot`, capacité `sparkles`, run `play`, approbation `shield-check`, crédits `coins`, budget `gauge`, clé `key-round`, journal `scroll-text`, danger `triangle-alert`, succès `circle-check`, info `info`.
- Logo : la marque provisoire (réseau de nœuds) est dans `assets/Logos` ; tant qu'aucun nom n'est choisi, le nom s'écrit en texte simple en `heading-3`.

## Accessibilité

- WCAG 2.1 AA : contrastes vérifiés dans les deux thèmes, navigation complète au clavier, focus visible, cibles ≥ 44px sur mobile.
- Chaque champ a un libellé visible ; les erreurs sont écrites en toutes lettres sous le champ et annoncées.
- Statuts et séries de graphiques jamais par la couleur seule (mot, icône, étiquette directe).
- Langue de la page déclarée (`lang="fr"` / `lang="en"`).

## Correspondance avec le code (Nuxt UI)

- Les tokens deviennent des variables CSS (`tokens.css`) reprises dans le thème Tailwind v4 (`@theme`) ; Nuxt UI : `primary` → violet (`primary`), `secondary` → corail (`accent`), `neutral` → échelle construite sur `ink`/`line`/`surface`, `success`/`warning`/`error`/`info` → statuts de ce système.
- Les classes `cp-*` de `components/bundle.css` sont la référence visuelle ; l'implémentation réelle utilise les composants Nuxt UI configurés pour reproduire exactement ces rendus.
