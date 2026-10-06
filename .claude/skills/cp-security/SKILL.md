---
name: cp-security
description: Checklist sécurité de project-cp pour audit et implémentation — isolation multi-tenant, secrets (Infisical), authentification, OAuth 2.1, clés d'API, injection (SQL, prompt), SSRF des connecteurs, exposition des données, en-têtes, dépendances, journalisation sans PII, conformité. Lire pour /audit-rules, une revue ou tout code sensible.
---

# Sécurité — project-cp

> Menaces IA : `docs/reference/05-garde-fous-ia.md` §7 · conformité : `docs/reference/01-specification-produit.md` §9 · rétention : `02` §12.

## Multi-tenant (priorité 1)
- [ ] Toute requête client via `withOrgContext` (RLS `app_rw`) ; aucun `app_admin` dans api / mcp-runtime / web
- [ ] FK composites `(id, organization_id)` sur toute relation interne ; tests d'isolation à deux organisations
- [ ] Ressource d'une autre organisation ⇒ 404 (jamais 403 révélateur) ; ids exposés = `public_id` uniquement
- [ ] Caches Redis et files préfixés par organisation ; aucune clé de cache partagée entre clients
- [ ] Capacités scellées : prompt jamais renvoyé ; IA interne (org 0) invisible (T16)

### IP client (rate limit, audit)
Toujours via `getClientIp()` : IP de la socket (`getConnInfo`) et, derrière Nginx, la valeur ajoutée par le proxy de
confiance (nombre de sauts configuré), **jamais la première valeur de `x-forwarded-for`** (fournie par le client).
IP inconnue ≠ `127.0.0.1` partagé. Limiteur Redis avec `insuranceLimiter` mémoire : une panne Redis ne bloque pas tout le monde.

## Secrets
- [ ] Coffre Infisical uniquement (connecteurs, BYOK, fournisseurs) ; lus au moment de l'appel, jamais en base, params, logs, réponses, traces OTel
- [ ] Config serveur via `env.ts` (zod) ; `.env*` jamais commité ; `runtimeConfig.public` sans secret
- [ ] Clés d'API, jetons MCP, sessions, codes : stockés hachés, préfixe affichable, comparaison en temps constant

## Authentification / autorisation (détail `cp-auth`)
- [ ] argon2id ; OTP borné (durée, essais, rate limit) ; OAuth social avec PKCE + state + nonce
- [ ] OAuth 2.1 MCP : PKCE S256 obligatoire, indicateur de ressource, consentement par portée, rotation + détection de réutilisation
- [ ] Policies : rôle + plan + flag + surcharge vérifiés côté serveur sur chaque route ; approbations non contournables

## Injection
- [ ] SQL : Drizzle / `sql\`\`` paramétré ; `sql.raw` seulement dans `packages/db` et revu ; connecteur client sans SQL libre, sans DELETE/DDL
- [ ] Prompt : contenus externes spotlightés ; aucune action réelle sur la seule décision du modèle ; sorties nettoyées
- [ ] XSS : pas de `v-html` brut (MDC + sanitisation), CSP stricte (`nuxt-security`)
- [ ] Commandes : aucun `exec`/`spawn` avec une entrée utilisateur (ffmpeg côté outillage seulement)

## Connecteurs et réseau sortant
- [ ] SSRF : résolution DNS vérifiée, IP privées/loopback/metadata (169.254.169.254) refusées, pas de redirection vers elles, liste de domaines
- [ ] Timeouts, taille de réponse bornée, TLS vérifié (jamais `rejectUnauthorized: false`)
- [ ] Bridge base de données sortant ; superutilisateur refusé ; utilisateur dédié

## Exposition et journaux
- [ ] Resources sans champ interne ; erreurs 5xx sans message brut ni pile
- [ ] Logs pino sans PII ni secret (redaction configurée : `authorization`, `cookie`, `password`, `token`, `secret`, `apiKey`) ;
      journaux de garde-fous = extrait masqué + empreinte
- [ ] Audit (`audit.events`) de toute action sensible (admin avec motif, arrêts d'urgence, clés, rôles, paiements)

## Transport, en-têtes, abus
- [ ] HTTPS + HSTS ; `secureHeaders` Hono ; CORS explicite (jamais `*` avec credentials)
- [ ] Rate limit par clé, organisation, IP ; 429 + `Retry-After` ; protection des formulaires publics
- [ ] Webhooks entrants : signature vérifiée, horodatage, déduplication ; sortants : HMAC

## Dépendances et chaîne d'approvisionnement
- [ ] `pnpm audit --prod` sans vulnérabilité critique ; versions épinglées (`catalog:`) ; lockfile commité
- [ ] Images Docker épinglées par digest ; aucun paquet abandonné pour un rôle sensible

## Conformité
- [ ] Données personnelles : minimisation, rétention (02 §12), export et suppression (30 jours de grâce), anonymisation des écritures financières
- [ ] Région de données respectée dans le routage des modèles
