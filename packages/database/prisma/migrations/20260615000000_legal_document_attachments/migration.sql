-- Legal document attachments — supporting files that extend a parent
-- LegalDocument as a single contract set (addendum, amendment, renewal
-- letter, signed PDF returned from outside the system, etc.).
--
-- The main agreement still lives on legal_documents.file_url/file_name;
-- this table only holds the *extra* files plus their own optional
-- effective / expiry dates. The service layer rolls these up into an
-- "effective expiry" for the parent document so a fresh addendum can
-- keep the contract alive after the original expiry date.
--
-- Idempotent: every CREATE / ALTER guards itself so a partial-apply
-- incident can re-run cleanly.

CREATE TABLE IF NOT EXISTS "legal_document_attachments" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "document_id"    UUID         NOT NULL,
  "kind"           TEXT         NOT NULL DEFAULT 'other',
  "label"          VARCHAR(300),
  "file_url"       TEXT         NOT NULL,
  "file_name"      VARCHAR(300) NOT NULL,
  "effective_date" DATE,
  "expiry_date"    DATE,
  "notes"          TEXT,
  "uploaded_by_id" UUID,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "legal_document_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "legal_document_attachments_document_id_idx"
  ON "legal_document_attachments"("document_id");

CREATE INDEX IF NOT EXISTS "legal_document_attachments_expiry_date_idx"
  ON "legal_document_attachments"("expiry_date");

DO $$ BEGIN
  ALTER TABLE "legal_document_attachments"
    ADD CONSTRAINT "legal_document_attachments_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "legal_documents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "legal_document_attachments"
    ADD CONSTRAINT "legal_document_attachments_uploaded_by_id_fkey"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
