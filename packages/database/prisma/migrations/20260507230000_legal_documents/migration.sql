-- Phase 1 Legal Tracker — licences and agreements with expiry tracking.
-- Idempotent: safe to re-run after a partial-apply incident.

CREATE TABLE IF NOT EXISTS "legal_documents" (
  "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
  "title"             TEXT         NOT NULL,
  "kind"              TEXT         NOT NULL,
  "reference"         TEXT,
  "parties"           TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "owner_id"          UUID         NOT NULL,
  "entity_id"         TEXT,
  "effective_date"    DATE,
  "expiry_date"       DATE,
  "renewal_lead_days" INTEGER      NOT NULL DEFAULT 30,
  "status"            TEXT         NOT NULL DEFAULT 'active',
  "file_url"          TEXT,
  "file_name"         TEXT,
  "notes"             TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "legal_documents_expiry_date_idx"
  ON "legal_documents"("expiry_date");
CREATE INDEX IF NOT EXISTS "legal_documents_kind_status_idx"
  ON "legal_documents"("kind", "status");
CREATE INDEX IF NOT EXISTS "legal_documents_entity_id_idx"
  ON "legal_documents"("entity_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'legal_documents_owner_id_fkey'
  ) THEN
    ALTER TABLE "legal_documents"
      ADD CONSTRAINT "legal_documents_owner_id_fkey"
      FOREIGN KEY ("owner_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'legal_documents_entity_id_fkey'
  ) THEN
    ALTER TABLE "legal_documents"
      ADD CONSTRAINT "legal_documents_entity_id_fkey"
      FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
