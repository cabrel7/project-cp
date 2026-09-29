---
name: cp-billing
description: Crédits et facturation de project-cp (packages/billing) — micro-crédits bigint, portefeuilles LLM/infra/test, lots FIFO et expiration, grand livre en ajout seul, réservation puis régularisation, découvert technique, calcul d'un débit (taux de change, coefficient, BYOK), remboursements, budgets multi-échelles, paiements Mobile Money idempotents, factures sans trou. Lire avant tout code qui touche l'argent ou les crédits.
---

# Crédits et facturation — project-cp

> Sources : `docs/reference/02-regles-metier.md` §3 (crédits, budgets), §6 (paiements), §7 (revenus Marketplace) ·
> `docs/reference/01-specification-produit.md` §6 (modèle économique, plans — prix provisoires D20) · schéma `030_billing.sql`.

## 1. Unités (non négociable)
- 1 crédit (cr) = 1 FCFA de valeur ; stocké en **micro-crédits** (1 cr = 1 000 000 µcr) en `bigint`.
- En TS : `bigint` natif pour les µcr ; `dinero.js` pour l'argent réel (XAF/XOF 0 décimale, EUR/USD 2) ; **jamais** `number` flottant,
  `parseFloat`, `toFixed`, `Math.round` sur un montant (guard). Conversions et arrondis dans UNE fonction documentée (arrondi au µcr supérieur).
- JSON : µcr en **string**. Affichage : `formatCredits` (cr, 0 à 1 décimale), `formatFcfa`.

## 2. Portefeuilles, lots, grand livre
- Trois portefeuilles par organisation : **LLM**, **infra**, **test** (sandbox) ; portefeuilles de workspace optionnels (allocation).
- Chaque entrée = **lot** (plan, achat, bonus, parrainage, promo, remboursement, geste commercial) ; consommation **FIFO par date d'expiration**.
  Achats sans expiration ; bonus/parrainage 6 mois ; crédits du plan valables sur la période, perdus au downgrade, prorata à l'upgrade.
- **Grand livre en ajout seul** avec solde après écriture ; correction = écriture inverse (trigger). Débit ventilé org → workspace → env → projet → run.

## 3. Réservation → régularisation (dans l'ordre)
```ts
// Au démarrage d'un run / d'un appel coûteux
const res = await billing.reserve(tx, { orgId, walletKind: 'llm', estimateMicro, runId, budgets })  // verrou, refus si insuffisant
// … appel …
await billing.settle(tx, { reservationId: res.id, actualMicro, breakdown })   // écrit au grand livre, libère le reste
// Erreur : billing.release(...) ou billing.refund(...) selon platform.error_codes.refunds
```
- Disponible = solde − réservations ; nouveau run refusé si insuffisant **ou** budget épuisé.
- **Découvert technique** (défaut 1 000 cr, paramètre) : seulement pour terminer un run déjà lancé ; jamais pour en démarrer un.
- Fonctions transactionnelles avec verrou (`SELECT … FOR UPDATE` sur le portefeuille ou `pg_advisory_xact_lock(org)`), testées en concurrence.

## 4. Calcul d'un débit (02 §3.5)
```
crédits LLM   = coût fournisseur (USD) × taux USD→XAF en vigueur × coefficient du plan
crédits infra = unités consommées × tarif du compteur (par plan ou défaut)
```
- Prix par déploiement et par unité (tokens entrée/sortie/cache, raisonnement, embeddings, image, audio, TTS, page, vidéo, requête), **datés sans chevauchement**.
- Chaque requête garde le **taux de change** et le **coefficient** appliqués.
- **BYOK** : pas de crédits LLM ; seulement infra (dont 0,1 cr par requête gateway).

## 5. Remboursements automatiques
Erreur interne plateforme ⇒ remboursé ; aucun fournisseur disponible ⇒ remboursé ; système externe injoignable après relances ⇒ partiel ;
incident déclaré ⇒ selon la politique. Le code d'erreur (`platform.error_codes.refunds_credits`) décide.

## 6. Budgets
Portées : organisation, workspace, environnement, projet, équipe, agent, clé API, **utilisateur final** ; périodes jour/semaine/mois/personnalisée ;
alertes 70 % / 90 % (défaut) ; au dépassement : alerte, blocage des nouveaux runs, blocage total. Suivi temps réel Redis (compteurs atomiques Lua),
consolidé en base par période. Le budget s'ajoute au portefeuille.

## 7. Paiements et factures
- Agrégateurs multiples, routage par pays/opérateur ; Mobile Money principal, carte (diaspora), virement (Enterprise) ; **aucun KYC**.
- Chaque paiement a une **clé d'idempotence** ; webhooks d'agrégateurs vérifiés (signature), journalisés, dédupliqués ; `settled_at` pour la trésorerie.
- Factures/avoirs **numérotés sans trou** par série et année (fonction verrouillée), données figées à l'émission, PDF dans le stockage objet.
- Renouvellement : rappel J-5 ; échec ⇒ `past_due` → grâce → plan Free (données conservées).
- Marketplace : 70 % créateur / 30 % plateforme, versement mensuel le 1er, seuil 5 000 F.

## Tests (obligatoires)
Concurrence (N réservations parallèles sur un solde juste : jamais négatif hors découvert) · FIFO par expiration · grand livre équilibré et immuable ·
régularisation < et > estimation · remboursement par code d'erreur · BYOK sans crédits LLM · budgets 70/90/100 % · webhook dupliqué ignoré ·
numérotation sans trou sous concurrence. Sommes vérifiées en `bigint` exact.

## Anti-patterns interdits
`number` pour de l'argent · UPDATE/DELETE sur le grand livre · débit sans réservation · réservation hors transaction · découvert pour démarrer un run ·
taux/coefficient non enregistrés · paiement sans idempotence · numéro de facture calculé par `max()+1` sans verrou.
