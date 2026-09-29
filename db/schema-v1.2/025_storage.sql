-- =============================================================================
-- 025_storage.sql — Fichiers (stockage objet S3-compatible : MinIO / OVH Object Storage)
-- La base ne contient que les métadonnées ; le binaire est dans le bucket.
-- =============================================================================

CREATE TABLE storage.files (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id           uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id     bigint      REFERENCES iam.organizations(id) ON DELETE CASCADE, -- NULL = fichier plateforme
  workspace_id        bigint,
  purpose             text        NOT NULL CHECK (purpose IN (
                        'avatar','connector_source','data_file','chat_attachment','agent_artifact',
                        'invoice_pdf','export','marketplace_asset','legal_document','support_attachment',
                        'eval_dataset','other')),
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
  UNIQUE (bucket, storage_key),
  UNIQUE (id, organization_id),
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX files_org_purpose_idx ON storage.files (organization_id, purpose, created_at DESC);
CREATE INDEX files_ws_org_idx      ON storage.files (workspace_id, organization_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX files_region_idx      ON storage.files (data_region_id);
CREATE INDEX files_uploader_idx    ON storage.files (uploaded_by_user_id);
CREATE INDEX files_expiry_idx      ON storage.files (expires_at) WHERE expires_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX files_scan_idx        ON storage.files (scan_status) WHERE scan_status IN ('pending','infected');

ALTER TABLE iam.users
  ADD CONSTRAINT users_avatar_file_fk FOREIGN KEY (avatar_file_id)
  REFERENCES storage.files(id) ON DELETE SET NULL;
CREATE INDEX users_avatar_idx ON iam.users (avatar_file_id);
