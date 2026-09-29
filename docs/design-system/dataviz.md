# Graphiques et chiffres

- **Chiffre seul d'abord** : une question à une réponse (« crédits restants ») est une `StatTile`, pas un graphique.
- **Évolution dans le temps** : courbe (2px) ou barres verticales ; **comparaison** : barres horizontales triées ; **part d'un tout** (≤ 5 parts) : barre empilée unique, pas de camembert.
- **Couleurs des séries** : `chart-1` à `chart-6` **dans cet ordre, sans recyclage** ; au-delà de 6 séries, regrouper en « Autres ». La couleur suit l'entité (un modèle garde sa couleur quand un filtre change). Palette validée daltonisme et contraste dans les deux thèmes ; `chart-5`/`chart-6` voisins exigent une étiquette directe ou une légende.
- **Statuts** (`success`, `warning`, `danger`) jamais utilisés comme couleurs de séries.
- **Un seul axe Y** ; deux mesures d'échelles différentes = deux graphiques.
- Grille et axes en `chart-grid`, texte des axes en `ink-muted` `caption` ; valeurs et légendes en `ink`, jamais dans la couleur de la série.
- Barres : extrémités arrondies 4px, 2px d'écart entre barres ; légende toujours présente dès 2 séries, étiquettes directes jusqu'à 4.
- **Survol** : infobulle sur chaque point/barre ; filtres de période sur une ligne au-dessus (7 j, 30 j, 90 j, personnalisé).
- **Accessibilité** : chaque graphique a une vue tableau (« Voir les données »).
- Implémentation : ECharts (`vue-echarts`) avec un thème clair et un thème sombre générés depuis ces tokens.
