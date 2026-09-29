# Button

Un seul bouton `primary` par vue, pour l'action pour laquelle la page existe ; les autres sont par défaut (bordure `line-strong`) ou `ghost`. Libellé = verbe + objet, casse de phrase (« Créer un agent »). `danger` seulement dans un `ConfirmDialog` ou une zone dangereuse. Tailles : `control-md` par défaut, `control-lg` sur mobile et pour l'action finale d'un assistant, `control-sm` en mode Technique dense. Pendant une action : spinner dans le bouton, libellé au présent (« Publication… »), bouton désactivé.

Le consommateur fournit : le libellé, la variante (`primary` · `secondary` · `ghost` · `danger`), la taille, l'état (`loading`, `disabled`), une icône optionnelle à gauche.
