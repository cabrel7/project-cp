# Garde-fous IA et IA interne de la plateforme

> **Nom de code :** `project-cp` · **Statut :** référence · Date : 29 septembre 2026
> Schéma : `097_guardrails.sql` · Données initiales : `960_seed_ai_system.sql`

---

## 1. Principes

1. **Le modèle ne décide jamais seul d'une action.** Toute action réelle (écrire, supprimer, payer, envoyer) passe par des contrôles **déterministes** : politique, bornes des paramètres, approbation. Une consigne dans un prompt (« ne supprime rien ») n'est **pas** une sécurité.
2. **Tout ce qui vient de l'extérieur est une donnée, jamais une instruction** : résultats d'outils, documents, emails, pages web. Ces contenus sont encadrés et marqués (*spotlighting*) avant d'être donnés au modèle.
3. **Défense en profondeur**, en 5 étapes : entrée → contexte → action → sortie → coûts.
4. **Du moins cher au plus cher** (cascade) :
   - d'abord les règles et expressions régulières (≈ 1–5 ms) ;
   - puis les petits modèles locaux (≈ 20–40 ms) ;
   - le juge IA (≈ 1 s) **uniquement** pour les cas ambigus ou à risque.
5. **Mesurer avant de bloquer :** tout nouveau détecteur ou seuil passe d'abord en **mode observation** (il note sans bloquer).
6. **Arrêt d'urgence** possible à toutes les échelles, sans redéployer.

---

## 2. Le pipeline

| Étape | Contrôles (détecteurs) | Actions possibles |
|---|---|---|
| **1. Entrée** | taille et format ; secrets (clés, mots de passe) ; données personnelles ; injection et jailbreak (**modèle local**) ; modération ; hors sujet | bloquer, masquer, signaler |
| **2. Contexte** | marquage des données non fiables ; **injection indirecte** dans les résultats d'outils et les documents (modèle local) ; budget et compression du contexte | signaler, bloquer, compresser |
| **3. Action** (avant chaque appel d'outil) | **politique OPA** (qui peut faire quoi, quand, sur quoi) ; **bornes des paramètres** (montant max, domaines email autorisés, listes) ; **approbation humaine** ; **détection de boucle** (même outil + mêmes paramètres) ; **volume anormal** par rapport à l'historique ; juge IA pour les actions à risque (profil strict) | bloquer, exiger une approbation, escalader au juge |
| **4. Sortie** | conformité au schéma JSON (relance automatique) ; fuite de secrets ou de données personnelles ; modération ; liens autorisés ; juge IA échantillonné | relancer, masquer, bloquer |
| **5. Coûts** | budgets et crédits ; itérations et durée ; plafond de tokens par appel ; disjoncteurs | bloquer |

**Optimisations de latence :**
- Les contrôles d'entrée tournent **en parallèle** du début de l'appel au modèle ; le flux est coupé immédiatement si un contrôle échoue.
- Les verdicts sont **mis en cache** par empreinte du contenu.
- Les contrôles coûteux sont **échantillonnés** sur les usages à faible risque et **systématiques** sur les actions à risque.
- Chaque détecteur a un **budget de latence** ; s'il le dépasse, la règle définit si l'on bloque (actions à risque) ou si l'on laisse passer en signalant (lecture).
- OPA tourne **dans le processus** (WebAssembly), sans appel réseau.

---

## 3. Profils

| Profil | Quand | Caractéristiques |
|---|---|---|
| **Standard** | Par défaut (chat, SDK, lecture) | Protège sans gêner ; injection bloquée au-delà d'un score de 0,95 |
| **Strict** | **Automatiquement** dès qu'un run peut écrire, supprimer, payer ou envoyer un message | Données personnelles masquées, injection bloquée dès 0,70, injection indirecte bloquée, anomalies bloquées, **juge IA sur les actions à risque**, liens non autorisés bloqués |
| **Interne** | IA de la plateforme | Sortie JSON stricte, injection indirecte bloquée |
| **Observation** | Tester un détecteur ou un seuil | Ne bloque rien, mesure (juge échantillonné à 5 %) |

- **Rattachement :** global → plan → organisation → workspace → environnement → capacité / agent / serveur MCP. Le plus spécifique l'emporte.
- Profils personnalisés par client : Pro et au-delà. Les profils système restent lisibles par les clients mais **non modifiables** (vérifié par le test T17).
- Le masquage des données personnelles avant l'envoi au modèle est une **option client** (utile pour la conformité, mais peut gêner certains usages).

---

## 4. Journal et amélioration continue

- Chaque déclenchement est journalisé (`usage.guardrail_events`) : étape, détecteur, score, action, latence, mode. Le journal ne contient **jamais le contenu brut**, seulement un extrait masqué et une empreinte.
- Le client et l'admin peuvent marquer un blocage **« faux positif »**. Ces retours servent à ajuster les seuils et à constituer les jeux d'évaluation.
- Tableaux de bord admin :
  - taux de blocage par détecteur ;
  - faux positifs ;
  - latence ajoutée ;
  - coût du juge IA ;
  - tentatives d'attaque par client.

---

## 5. Arrêts d'urgence

`platform.emergency_stops`, lu depuis Redis et effectif **immédiatement** :

| Portée | Exemple |
|---|---|
| Global | Incident majeur : plus aucun run |
| Organisation | Client compromis ou en abus |
| Agent | Agent qui s'emballe |
| Modèle / fournisseur / déploiement | Fournisseur défaillant, modèle qui dérive |
| Serveur MCP / outil | Outil qui fait des dégâts |
| Capacité | Prompt système défectueux |
| Fonction | Couper une fonction (en plus des feature flags) |

Chaque arrêt a un motif, un auteur, une date d'expiration optionnelle et apparaît dans l'audit. Code renvoyé : `EMERGENCY_STOP_ACTIVE`.

---

## 6. IA interne de la plateforme (gérée depuis l'admin)

La plateforme utilise elle-même l'IA. Ces fonctions sont des **capacités** appartenant à l'**organisation système** (id 0), avec **le même outillage que les clients** : versions, mise en production par environnement, test A/B, évaluations, traçabilité des coûts. Les clients ne voient jamais ces prompts (vérifié par le test T16).

| Capacité | Rôle | Profil de modèle |
|---|---|---|
| `system.mcp.semantize` | API ou schéma → outils MCP sémantiques avec risques | Max |
| `system.mcp.describe_quality` | Score de qualité des descriptions d'outils | Flash |
| `system.mcp.nl_to_actions` | Description en français → actions à confirmer | Smart |
| `system.mcp.sql_templates` | Schéma de base → requêtes paramétrées sûres | Max |
| `system.guard.judge` | Juge des actions et sorties à risque | Smart |
| `system.guard.injection_review` | Analyse d'injection de second niveau | Smart |
| `system.agent.approval_summary` | Résumé clair d'une action à approuver | Flash |
| `system.agent.config_from_nl` | « Décris ton agent » → configuration | Smart |
| `system.chat.workspace_assistant` | Assistant du workspace | Smart |
| `system.onboarding.copilot` | Guide de démarrage selon le profil | Flash |
| `system.run.explain_error` | Explication d'erreur pour non-spécialistes | Flash |
| `system.context.compress` | Compression de l'historique | Flash |
| `system.support.triage` | Tri des tickets de support | Flash |
| `system.eval.grader` | Notation des évaluations | Smart |

Les prompts v1 sont des **brouillons** (non verrouillés).

**Règles de gestion dans l'admin :**
1. Modifier un prompt système crée une **nouvelle version** ; une version publiée est verrouillée.
2. **Aucune mise en production sans évaluation réussie** au-dessus du seuil défini (`min_eval_score` sur la mise en production).
3. Déploiement progressif possible (A/B, par exemple 10 % du trafic), puis 100 %.
4. Retour arrière en un clic ; arrêt d'urgence par capacité.
5. Coût de l'IA interne suivi comme celui d'un client (organisation 0), avec un budget dédié.
6. Qui peut modifier : Super admin, et Ops pour les garde-fous. Toute modification est auditée.

**Module « IA de la plateforme » du back-office :**
- prompts système (éditeur, versions, comparaison, évaluations, mise en production) ;
- jeux d'évaluation ;
- détecteurs (seuils, budgets de latence, activation) ;
- profils et rattachements ;
- file des blocages à revoir (faux positifs) ;
- arrêts d'urgence ;
- modèles autorisés par plan et par région ;
- coûts de l'IA interne.

---

## 7. Menaces couvertes

| Menace | Réponse |
|---|---|
| Injection directe (« ignore tes instructions ») | Classifieur local + cadrage du prompt système + contrôle déterministe des actions |
| Injection indirecte (email ou document piégé lu par un outil) | Marquage des données + classifieur sur les résultats d'outils + actions toujours soumises aux politiques |
| Exfiltration de données | Isolation par client en base, liens autorisés, détection de fuite en sortie, secrets jamais dans le contexte |
| Action destructrice | Suppression et paiement : approbation obligatoire (contrainte en base) ; SQL sans DELETE ; bornes des paramètres |
| Emballement / boucle / facture qui explose | Itérations, durées, détection de boucle, budgets, réservation de crédits, arrêt d'urgence |
| Outil malveillant (Marketplace) | Scan, permissions déclarées = réelles, revue Verified, suspension immédiate sur signalement de sécurité |
| Abus de l'offre gratuite | OTP par numéro, rate limits, signaux d'abus, liste de blocage |
| Contenu illicite | Modération en entrée et en sortie |
| Dérive d'un prompt système | Évaluation obligatoire avant production, A/B, retour arrière |
