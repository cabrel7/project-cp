# Proposition — Connaissances (bases de connaissances des agents et du chat)

> **Statut : 🟡 proposition (D65), à valider par Dylan.** Rien n'est encore dans 01/02/04/05 ni dans le SQL.
> Une fois validée, ce contenu est réparti dans 01 (produit), 02 (règles), 04 (schéma), 05 (garde-fous) et 08 (plan),
> puis ce fichier est archivé.
> Date : 2026-10-12.

## 1. Le besoin

Les agents et le chat accèdent aujourd'hui aux **systèmes vivants** (API, bases, logiciels) via les serveurs MCP. Il
manque les **données non structurées** : une PME camerounaise n'a souvent pas d'ERP, mais elle a un catalogue en PDF,
des CGV en Word, une liste de prix en Excel, des photos de factures envoyées par WhatsApp. Sans elles, un assistant
client ne peut pas répondre aux vraies questions métier.

Existant à réutiliser : `storage.files` + backends S3 (D51, D52), pgvector (déjà utilisé par `mcp.tool_embeddings` et
`agent.memories`), workers BullMQ, pipeline de garde-fous (05), capacités internes et routage (D45, D46).
Ce qui n'existe pas : aucun domaine « source → document → morceaux → recherche » (vérifié dans la baseline 0001).

## 2. Périmètre

| | v1 (proposée) | Plus tard |
|---|---|---|
| Sources | Fichiers téléversés ; URL publiques (une page, pas d'exploration de site) | Google Drive, Notion, SharePoint, site complet (via connecteurs P5) ; resynchronisation planifiée |
| Formats | PDF (texte **et scanné**), DOCX, PPTX, HTML, Markdown, TXT, images (PNG, JPEG, WEBP), XLSX, CSV | Audio et vidéo (Docling sait les transcrire), e-mails (EML/MSG) |
| Usage | Chat du workspace et agents : outil `search_knowledge` + citations | RAG automatique avant chaque appel (opt-in par agent), reclassement (*rerank*) |
| Exposition | Interne (chat, agents) | Ressource / outil MCP sur les serveurs publiés ; API et SDK (P6) |

## 3. Extraction : Docling

**Proposition : [Docling](https://github.com/docling-project/docling) (IBM, licence MIT) via `docling-serve`**, service
interne qui convertit les documents en **Markdown** (pour les morceaux) et en **JSON structuré** (pages, titres,
tableaux, positions — pour les citations).

Pourquoi Docling :
- un seul moteur pour presque tous les formats de la v1 : PDF, DOCX, XLSX, PPTX, HTML, CSV, Markdown, images
  ([formats pris en charge](https://docling-project.github.io/docling/usage/supported_formats/)) ;
- **OCR intégré** pour les PDF scannés et les photos, avec analyse de la mise en page et des **tableaux** (là où les
  extracteurs simples perdent la structure) ;
- sortie Markdown + JSON + découpage prêt pour le RAG ; auto-hébergé, hors ligne, gratuit — cohérent avec D51
  (pas de dépendance à un fournisseur, données dans notre région).

Comment l'intégrer (la stack reste TypeScript) :
- `docling-serve` tourne comme **service Docker interne** (image CPU `docling-serve-cpu`, ≈ 4,4 Go d'image),
  appelé uniquement par le worker (`POST /v1/convert/...`), **jamais exposé** sur Internet ;
- **bac à sable** : conteneur non root, système de fichiers en lecture seule, **aucune sortie réseau** (modèles
  embarqués dans l'image, mode hors ligne), limite mémoire et CPU, délai maximum par document, taille et nombre de
  pages plafonnés (fichiers piégés, bombes ZIP) ;
- **concurrence 1** sur le VPS-4 (8 vCores, 24 Go, ≈ 12-13 Go déjà utilisés) : file BullMQ dédiée, un document à la
  fois, priorité basse ;
- formats triviaux (TXT, Markdown, CSV simple) traités directement en Node, sans passer par Docling.

**À prouver par un spike (S, avant le lot K.2)** sur 10 vrais documents de chez nous (facture scannée en français,
catalogue PDF, liste de prix Excel, photo WhatsApp, CGV Word) : qualité de l'OCR en français, tableaux, temps par
page, **RAM réelle** (non documentée par le projet), comparaison des moteurs OCR proposés par Docling. Si la RAM ou le
temps ne tiennent pas sur le VPS-4 : Docling sur une petite machine dédiée, ou OCR désactivé en v1.

## 4. Pipeline d'ingestion (worker)

```
Téléversement / URL
  → storage.files (backend actif, D52) + knowledge.documents (statut « en attente »)
  → file BullMQ « knowledge-ingest »
  → extraction (Docling, ou Node pour les formats simples) → Markdown + structure (pages, titres, tableaux)
  → contrôle « injection indirecte » (étape 2 du pipeline de garde-fous, 05) → document marqué, pas bloqué en silence
  → découpage par sections (titres), ≈ 500-800 jetons, léger recouvrement, page et section conservées
  → embeddings via une capacité interne `system.knowledge.embed` (LiteLLM, invariant 4), modèle fixé par index
  → pgvector + texte plein (tsvector fr/en) → statut « prêt »
```

- Même contenu (empreinte sha256) → pas de nouvelle ingestion ; nouvelle version d'un document → réindexation, l'ancienne
  version reste citable jusqu'à la fin de l'indexation.
- Échec → statut « erreur » avec un message compréhensible en mode Simple (« page 3 illisible ») et relance possible.

**Tableurs (XLSX, CSV).** Un tableau découpé en morceaux répond mal à « combien coûte X ? ». En v1 : chaque ligne
devient un morceau qui répète les en-têtes (« Produit : Savon 400 g · Prix : 650 FCFA · Stock : 12 ») **et** le tableau
est conservé en lignes structurées, interrogeables par un outil déterministe `lookup_rows` (filtres exacts sur les
colonnes, jamais de SQL libre — même principe que le connecteur base de données, 02 §4.5).

## 5. Recherche et usage

- **Recherche hybride** : similarité vectorielle + texte plein (références produits, noms propres), fusion des
  classements (RRF), filtres par source et par droits ; reclassement en v2.
- **Citations obligatoires** : chaque passage renvoyé porte document, page et section ; l'interface affiche la source.
- **Spotlighting** : les passages sont marqués comme données non fiables avant d'entrer dans le contexte (05 §1).
- **Modes** : outil `search_knowledge` (l'agent décide, défaut) ; RAG automatique en option par agent (coûte des jetons
  à chaque message).
- **Droits** : une base appartient à un workspace ; un agent n'y accède que si l'accès lui est **accordé par version**
  (même modèle que les accès MCP et capacités) ; le chat du workspace voit les bases du workspace.

## 6. Données — domaine `knowledge` (à écrire par l'agent database au lot K.1)

| Table | Rôle | Points clés |
|---|---|---|
| `knowledge.sources` | Base de connaissances (collection) | `organization_id`, `workspace_id`, nom i18n, mode de recherche, RLS |
| `knowledge.documents` | Un document d'une base | `file_id` → `storage.files` ou `url`, `content_hash`, statut, langue, nombre de pages, erreur |
| `knowledge.document_versions` | Versions successives | une seule version active ; ancienne gardée pendant la réindexation |
| `knowledge.chunks` | Morceaux indexés | `embedding vector(1536)`, `embedding_model`, `tsv`, page, section, ordre ; index HNSW + GIN ; FK composites |
| `knowledge.table_rows` | Lignes des tableurs | `jsonb` par ligne + en-têtes, pour `lookup_rows` |
| `knowledge.ingestion_jobs` | Suivi et reprise | étapes, durée, pages, coût, erreur |
| `agent.knowledge_grants` | Accès d'une version d'agent à une base | comme les accès MCP |

Toutes avec `organization_id` + RLS (invariant 2), `public_id` UUIDv7 exposé (invariant 1). Suppression d'un document →
suppression de ses morceaux et lignes, et du fichier (droit à l'effacement, 02 §12).

## 7. Coûts, plans, conformité

- **Crédits infra** (D12) : par page ingérée (OCR plus cher que texte), par Mo-mois stocké, par recherche ; montants
  dans le chantier A (marges et prix).
- **Limites par plan** : nombre de bases, de documents, taille totale, OCR inclus ou non — à ajouter à la grille 01 §6.3.
- **Conformité** : documents dans la région de données de l'organisation ; jamais utilisés pour entraîner un modèle ;
  détection de données personnelles signalée à l'ingestion ; rétention alignée sur 02 §12.

## 8. Interface

- Écran **Connaissances** (gabarits G1 liste + G2 détail) : téléversement par glisser-déposer et depuis le téléphone,
  état d'indexation en temps réel, aperçu du texte extrait, recherche d'essai avec citations.
- Glossaire (D49) : Simple « **Connaissances** » / Technique « **Bases de connaissances** » ; « Document » dans les deux modes.
- **Maquette à produire** (Claude Design) avant le lot front.

## 9. Place dans le plan (08)

Dépendances réelles : stockage des fichiers (P2.8), LiteLLM et garde-fous (P4.1-P4.3), worker BullMQ. **Pas** le MCP
Builder. Utile dès le chat (P4.6) et indispensable aux agents (P7).

Proposition : **phase « P5b — Connaissances », en parallèle de P5, après P4**, avec un spike Docling qui peut être
fait plus tôt (hors chemin critique).

| Lot | Contenu | Taille |
|---|---|---|
| K.0 | Spike Docling (§3) : 10 documents réels, qualité OCR FR, RAM et temps → verdict | S |
| K.1 | Domaine `knowledge` (migration, RLS, tests SQL, doc 04) | M |
| K.2 | `docling-serve` en bac à sable (compose, limites) + worker d'ingestion + découpage + embeddings | L |
| K.3 | Recherche hybride + citations + outil `search_knowledge` + `lookup_rows` ; branchement sur le chat | M |
| K.4 | Écran Connaissances (maquette validée d'abord) | M |
| K.5 | Accès par agent (P7), exposition MCP et SDK (P6), facturation | M |

## 10. Décisions à prendre

| # | Question | Proposition |
|---|---|---|
| D65 | Ajouter la brique « Connaissances » au produit | Oui, sous-brique de l'AI Runtime partagée par le chat, les agents et le MCP |
| D65-a | Extracteur | Docling (`docling-serve`, MIT) en bac à sable, sous réserve du spike K.0 |
| D65-b | OCR (scans, photos) en v1 | Oui si le spike tient sur le VPS-4 ; sinon v1 sans OCR |
| D65-c | Tableurs | Lignes avec en-têtes + outil `lookup_rows` déterministe |
| D65-d | Place dans le plan | P5b, en parallèle de P5, après P4 ; spike K.0 plus tôt |

## 11. Risques

- **Injection indirecte** par un document piégé → contrôle à l'ingestion + spotlighting + actions toujours soumises aux
  contrôles déterministes (invariant 6).
- **RAM / CPU** du VPS-4 saturés par l'OCR → concurrence 1, plafonds, spike, machine dédiée si besoin.
- **Fichiers malveillants** visant le parseur → bac à sable sans réseau, non root, délais.
- **Coût** des embeddings sur de gros volumes → empreinte anti-doublon, plafonds par plan, crédits infra.
- **Qualité** sur les documents africains (scans de mauvaise qualité, mélange français/anglais/langues locales) →
  mesurée au spike, message clair à l'utilisateur si un document est mal lu.

Sources : [docling-serve (GitHub)](https://github.com/docling-project/docling-serve) ·
[Formats pris en charge par Docling](https://docling-project.github.io/docling/usage/supported_formats/) ·
[Docling (GitHub)](https://github.com/docling-project/docling)
