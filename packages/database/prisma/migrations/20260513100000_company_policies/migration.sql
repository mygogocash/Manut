-- Company-wide policy / handbook documents. HR/admin uploads, everyone
-- with `policy:read` can view + download. Mirrors the EmployeeAgreement
-- shape (files in private `documents` bucket, signed-URL fetch).

CREATE TABLE IF NOT EXISTS "company_policies" (
  "id"              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "title"           VARCHAR(200) NOT NULL,
  "category"        VARCHAR(40)  NOT NULL,
  "description"     TEXT,
  "file_url"        TEXT         NOT NULL,
  "file_name"       TEXT         NOT NULL,
  "mime_type"       TEXT,
  "file_size"       INTEGER,
  "version"         VARCHAR(40),
  "effective_date"  DATE,
  "entity_id"       TEXT,
  "is_active"       BOOLEAN      NOT NULL DEFAULT TRUE,
  "uploaded_by_id"  UUID,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "company_policies_entity_fk"
    FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL,
  CONSTRAINT "company_policies_uploader_fk"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "company_policies_category_idx"
  ON "company_policies" ("category");

CREATE INDEX IF NOT EXISTS "company_policies_entity_idx"
  ON "company_policies" ("entity_id");

CREATE INDEX IF NOT EXISTS "company_policies_active_idx"
  ON "company_policies" ("is_active");
