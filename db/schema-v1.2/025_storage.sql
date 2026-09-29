-- =============================================================================
-- 025_storage.sql — Fichiers (stockage objet S3-compatible, D52)
-- La base ne contient que les métadonnées ; le binaire est dans le bucket d'un
-- « backend » de stockage : SeaweedFS sur notre serveur (défaut, gratuit) ou
-- OVH Object Storage. Le backend actif se choisit dans l'admin ; chaque fichier
-- retient le backend où il se trouve (migration en tâche de fond).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Backends de stockage (catalogue plateforme, géré depuis l'admin)
-- Aucun secret ici : credentials_secret_ref = chemin dans le coffre (Infisical).
-- -----------------------------------------------------------------------------
CREATE TABLE storage.backends (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id              uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  key                    text        NOT NULL UNIQUE CHECK (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name                   jsonb       NOT NULL CHECK (util.is_i18n(name)),
  kind                   text        NOT NULL CHECK (kind IN ('seaweedfs','s3')),  -- seaweedfs = serveur local ; s3 = OVH ou autre fournisseur S3
  provider               text        NOT NULL CHECK (provider IN ('self_hosted','ovh','other')),
  endpoint               text        NOT NULL,
  region                 text        NOT NULL DEFAULT 'us-east-1',
  bucket                 text        NOT NULL,
  force_path_style       boolean     NOT NULL DEFAULT true,
  credentials_secret_ref text        NOT NULL,
  data_region_id         bigint      NOT NULL REFERENCES ref.data_regions(id),
  status                 text        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','read_only','draining','disabled')),
  is_write_target        boolean     NOT NULL DEFAULT false,  -- reçoit les nouveaux fichiers
  capacity_bytes         bigint      CHECK (capacity_bytes IS NULL OR capacity_bytes > 0),  -- disque disponible (local) ; NULL = illimité
  alert_threshold_pct    smallint    NOT NULL DEFAULT 80 CHECK (alert_threshold_pct BETWEEN 50 AND 99),
  lock_version           integer     NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT backends_write_target_active CHECK (NOT is_write_target OR status = 'active')
);
-- Un seul backend d'écriture par région de données
CREATE UNIQUE INDEX backends_one_write_target_per_region
  ON storage.backends (data_region_id) WHERE is_write_target;
CREATE INDEX backends_region_idx ON storage.backends (data_region_id);

CREATE TABLE storage.files (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id           uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id     bigint      REFERENCES iam.organizations(id) ON DELETE CASCADE, -- NULL = fichier plateforme
  workspace_id        bigint,
  purpose             text        NOT NULL CHECK (purpose IN (
                        'avatar','connector_source','data_file','chat_attachment','agent_artifact',
                        'invoice_pdf','export','marketplace_asset','legal_document','support_attachment',
                        'eval_dataset','other')),
  backend_id          bigint      NOT NULL REFERENCES storage.backends(id),  -- où se trouve le binaire (D52)
  bucket              text        NOT NULL,
  storage_key         text        NOT NULL,
  filename            text        NOT NULL,
  mime_type           text        NOT NULL,
  size_bytes          bigint      NOT NULL CHECK (size_bytes >= 0),
  checksum_sha256     bytea,
  data_region_id      bigint      NOT NULL REFERENCES ref.data_regions(id),
  scan_status         text        NOT NULL DEFAULT 'pending'
                      CHECK (scan_status IN ('pending','clean','infected','skipped','failed')),
  uploaded_by_user_id bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  metadata            jsonb       NOT NULL DEFAULT '{}',
  expires_at          timestamptz,                 -- exports temporaires, etc.
  created_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  UNIQUE (backend_id, bucket, storage_key),
  UNIQUE (id, organization_id),
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX files_org_purpose_idx ON storage.files (organization_id, purpose, created_at DESC);
CREATE INDEX files_ws_org_idx      ON storage.files (workspace_id, organization_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX files_region_idx      ON storage.files (data_region_id);
CREATE INDEX files_backend_idx     ON storage.files (backend_id, id);
CREATE INDEX files_uploader_idx    ON storage.files (uploaded_by_user_id);
CREATE INDEX files_expiry_idx      ON storage.files (expires_at) WHERE expires_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX files_scan_idx        ON storage.files (scan_status) WHERE scan_status IN ('pending','infected');

-- -----------------------------------------------------------------------------
-- Migrations entre backends (copie → vérification sha256 → bascule → suppression
-- de l'original). Lancées depuis l'admin, exécutées par apps/worker, reprenables.
-- -----------------------------------------------------------------------------
CREATE TABLE storage.backend_migrations (
  id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id                uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  from_backend_id          bigint      NOT NULL REFERENCES storage.backends(id),
  to_backend_id            bigint      NOT NULL REFERENCES storage.backends(id),
  status                   text        NOT NULL DEFAULT 'queued'
                           CHECK (status IN ('queued','running','paused','completed','failed','cancelled')),
  delete_source            boolean     NOT NULL DEFAULT true,   -- supprimer l'original après vérification
  files_total              bigint      NOT NULL DEFAULT 0 CHECK (files_total >= 0),
  files_done               bigint      NOT NULL DEFAULT 0 CHECK (files_done >= 0),
  files_failed             bigint      NOT NULL DEFAULT 0 CHECK (files_failed >= 0),
  bytes_total              bigint      NOT NULL DEFAULT 0 CHECK (bytes_total >= 0),
  bytes_done               bigint      NOT NULL DEFAULT 0 CHECK (bytes_done >= 0),
  last_file_id             bigint,                              -- point de reprise
  reason                   text        NOT NULL CHECK (length(reason) >= 5),  -- motif obligatoire
  started_by_staff_user_id bigint,                              -- FK ajoutée dans 090_platform.sql
  started_at               timestamptz,
  finished_at              timestamptz,
  last_error               text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT backend_migrations_distinct CHECK (from_backend_id <> to_backend_id),
  CONSTRAINT backend_migrations_progress CHECK (files_done + files_failed <= files_total OR files_total = 0)
);
-- Une seule migration active à la fois depuis un même backend
CREATE UNIQUE INDEX backend_migrations_one_active
  ON storage.backend_migrations (from_backend_id) WHERE status IN ('queued','running','paused');
CREATE INDEX backend_migrations_from_idx ON storage.backend_migrations (from_backend_id);
CREATE INDEX backend_migrations_to_idx   ON storage.backend_migrations (to_backend_id);

ALTER TABLE iam.users
  ADD CONSTRAINT users_avatar_file_fk FOREIGN KEY (avatar_file_id)
  REFERENCES storage.files(id) ON DELETE SET NULL;
CREATE INDEX users_avatar_idx ON iam.users (avatar_file_id);
