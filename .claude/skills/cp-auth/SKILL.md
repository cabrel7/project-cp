---
name: cp-auth
description: Authentification et autorisation de project-cp — comptes (e-mail + mot de passe argon2, téléphone + OTP SMS, clés d'accès WebAuthn, Google et Apple via arctic), sessions, 2FA TOTP, rôles et équipes, clés d'API, serveur OAuth 2.1 pour clients MCP (oidc-provider, POC D26), résolution des jetons via app_auth. Lire avant tout code d'identité, de session ou de jeton.
---

# Authentification — project-cp

> Sources : `docs/reference/01-specification-produit.md` (publics, rôles) · `02-regles-metier.md` §2 (organisations, rôles), §4.6 (clients MCP) ·
> décisions D26 (oidc-provider POC), D35 (Google + Apple, pas GitHub), D42 (une clé par app) · schéma `020_iam.sql`, `055_oauth.sql`, `070_dev.sql` ·
> maquettes page 1 (authentification) et G8 (consentement).

## 1. Principes
Brique par brique sur **nos** tables `iam` (pas d'IdP externe) : `@node-rs/argon2`, `@oslojs/crypto`, `@oslojs/otp`, `@simplewebauthn/server`,
`arctic` (Google, Apple), `jose`, `libphonenumber-js`. Résolution des identifiants avec la connexion **`app_auth`** (droits minimes), puis tout
le reste en `app_rw` + contexte.

## 2. Méthodes de connexion
- E-mail + mot de passe : argon2id (paramètres OWASP), politique de mot de passe raisonnable + vérification de fuite (k-anonymat) optionnelle.
- Téléphone + OTP SMS : numéro normalisé E.164 (`libphonenumber-js`, numéros africains), code 6 chiffres, 5 min, 5 essais, rate limit par numéro et IP.
- Clés d'accès (WebAuthn) : enregistrement et connexion sans mot de passe.
- **Google et Apple** uniquement (D35) via `arctic` : PKCE + `state` + `nonce`, liaison au compte existant par e-mail vérifié seulement.
- 2FA : TOTP (`@oslojs/otp`) + codes de secours hachés ; exigible par l'organisation.
- Mot de passe oublié : jeton à usage unique haché, 30 min, invalidation des sessions à la réinitialisation.

## 3. Sessions
Jeton aléatoire 256 bits, stocké **haché** (`iam.user_sessions`), cookie `HttpOnly; Secure; SameSite=Lax`, durée glissante, révocation (déconnexion
partout), rotation à l'élévation (2FA). CSRF : middleware Hono `csrf` + SameSite. Minuteur de session plus court et visible dans l'admin.

## 4. Organisations, rôles, équipes (02 §2)
Rôles système : Owner, Admin, Developer, Operator, Viewer ; rôles personnalisés Enterprise ; équipes Business+. Toujours ≥ 1 Owner.
Invitations 7 jours, une seule en attente par e-mail/org. Permissions (`iam.permissions`) vérifiées dans les policies (`cp-hono`), jamais dans le handler.
Le profil d'onboarding ne donne **aucun** droit (D41) ; les droits viennent du plan (`billing.features`) et du rôle.

## 5. Clés d'API (D42)
`cp_live_…` / `cp_test_…` : préfixe affichable, secret haché (SHA-256 + pepper), liée à **un environnement**, portées, IP et origines autorisées,
expiration optionnelle, révocable ; une clé par app/outil ; affichée une seule fois (`SecretField`). Elle appelle nos capacités, jamais un modèle brut.

## 6. OAuth 2.1 pour les clients MCP (`apps/auth`, POC D26)
`oidc-provider` (panva) adossé à nos tables (adapter Postgres) : enregistrement dynamique des clients, code + **PKCE S256 obligatoire**,
indicateur de ressource (`resource` = URL du serveur MCP), consentement explicite par serveur et par portée (écran G8), jeton d'accès court +
refresh avec **rotation** (réutilisation détectée ⇒ révocation de toute la famille), métadonnées `/.well-known/oauth-authorization-server` et
`oauth-protected-resource` côté mcp-runtime. Jetons statiques pour Cursor / Claude Desktop (préfixe, haché, portée, révocable).
Le POC doit valider : Claude et ChatGPT de bout en bout, révocation, rotation. Échec du POC ⇒ décision au journal 06 avant toute alternative.

## 7. Sécurité
Rate limit strict (connexion, OTP, réinitialisation, inscription) · messages d'erreur non discriminants (« identifiants invalides ») ·
journal d'audit des événements d'identité (connexion, échec, 2FA, changement de mot de passe, clé créée/révoquée) · aucune donnée d'auth dans les logs.

## Tests
Chaque méthode : succès, échec, expiration, rejeu, rate limit ; rotation refresh + détection de réutilisation ; PKCE absent refusé ; clé d'API hors
IP/origine/environnement refusée ; Owner unique ne peut pas partir ; isolation inter-organisations des sessions et des clés.

## Anti-patterns interdits
Mot de passe ou jeton stocké en clair · bcrypt/sha256 pour un mot de passe · jeton en localStorage · GitHub en fournisseur social (D35) ·
OAuth sans PKCE · refresh non roté · rôle vérifié dans le handler · profil d'onboarding utilisé comme droit · `app_admin` pour résoudre un jeton.
