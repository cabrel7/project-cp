# Contenu et ton

## Voix

- **Simple, direct, bienveillant.** Des phrases courtes, des verbes d'action, aucun jargon en mode Simple.
- **Vouvoiement** en français (« Connectez votre boutique ») ; « you » neutre en anglais.
- On parle du **résultat** pour l'utilisateur, pas de la technique : « Votre assistant peut maintenant voir vos commandes » plutôt que « Serveur MCP publié en v1.0.0 ».
- Boutons : verbe à l'infinitif + objet, casse de phrase (« Créer un agent », « Connecter un système »). Jamais « OK » ou « Valider » seuls quand l'effet peut être nommé.
- Pas de point d'exclamation dans les messages d'erreur ; pas d'emoji ; pas de culpabilisation (« Vous avez fait une erreur »).
- Montants : « 4 900 FCFA », « 12 430 cr ». Dates relatives récentes (« il y a 2 min »), absolues au-delà d'une semaine (« 12 oct. 2026 »).
- Les deux langues sont complètes : aucune chaîne n'est codée en dur, tout passe par i18n.

## Glossaire Simple / Technique

| Mode Simple (défaut) | Mode Technique | Remarque |
|---|---|---|
| Système connecté | Connecteur | |
| Accès IA / Point d'accès pour l'IA | Serveur MCP | En Simple : « Votre boutique est accessible à l'IA » |
| Action | Outil (tool) | |
| Assistant automatique | Agent | « Agent » est accepté partout s'il est expliqué une fois |
| Fonction IA | Capacité (`ai.run`) | |
| Exécution | Run | |
| Crédits | Crédits · tokens | Les tokens n'apparaissent qu'en Technique |
| Profil Rapide / Équilibré / Expert | Flash / Smart / Max | |
| Clé d'accès | Clé API | |
| Votre propre clé IA | BYOK | |
| Règles de sécurité | Politiques / garde-fous | |
| À valider | Approbation requise | |

## Messages types

- **Vide** : « Aucun assistant pour l'instant. Créez-en un en décrivant ce qu'il doit faire. » + bouton « Créer un assistant ».
- **Succès** : « Votre boutique est connectée. L'IA peut maintenant consulter vos commandes. » + « Essayer dans le chat ».
- **Erreur de connexion** : « Nous n'arrivons pas à joindre votre boutique. Vérifiez que l'adresse est correcte, puis réessayez. » + « Réessayer » ; en Technique : `MCP_CONNECTOR_UNREACHABLE` · `req_…`.
- **Crédits bas** : « Il vous reste 480 crédits, environ 3 jours d'utilisation. » + « Recharger ».
- **Approbation** : « L'assistant Relances veut envoyer 3 emails de rappel (total dû : 146 000 FCFA). » + « Voir et approuver ».
- **Fonction du plan supérieur** : « Les assistants planifiés sont inclus dans le plan Starter. » + « Voir les plans ».
