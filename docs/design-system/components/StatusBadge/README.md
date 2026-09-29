# StatusBadge

Montre l'état d'un objet avec **un point, un mot et une couleur de statut**, jamais la couleur seule. Correspondance fixe avec les cycles de vie (voir les règles métier) : Actif / En ligne / Réussi → `success` ; En pause / Attention / À valider → `warning` ; Erreur / Échec / Révoqué → `danger` ; Brouillon / Archivé → neutre ; En cours / En validation → `info`. « Nouveau » utilise l'`accent` (corail) et n'est pas un statut.

Le consommateur fournit : le statut métier (traduit automatiquement).
