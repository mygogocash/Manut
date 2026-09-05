-- Phase 2 Legal Signing — in-house e-signature flow tied to LegalDocument.
-- Idempotent: safe to re-run after a partial-apply incident.

CREATE TABLE IF NOT EXISTS "legal_signatures" (
  "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
  "document_id"       UUID         NOT NULL,
  "signer_email"      TEXT         NOT NULL,
  "signer_name"       TEXT         NOT NULL,
  "token"             TEXT         NOT NULL,
  "status"            TEXT         NOT NULL DEFAULT 'pending',
  "invite_message"    TEXT,
  "sent_at"           TIMESTAMP(3),
  "viewed_at"         TIMESTAMP(3),
  "signed_at"         TIMESTAMP(3),
  "declined_at"       TIMESTAMP(3),
  "decline_reason"    TEXT,
  "signature_text"    TEXT,
  "signature_method"  TEXT,
  "signed_ip"         TEXT,
  "signed_user_agent" TEXT,
  "expires_at"        TIMESTAMP(3),
  "created_by_id"     UUID         NOT NULL,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "legal_signatures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "legal_signatures_token_key"
  ON "legal_signatures"("token");

CREATE INDEX IF NOT EXISTS "legal_signatures_document_id_idx"
  ON "legal_signatures"("document_id");
CREATE INDEX IF NOT EXISTS "legal_signatures_status_idx"
  ON "legal_signatures"("status");
CREATE INDEX IF NOT EXISTS "legal_signatures_token_idx"
  ON "legal_signatures"("token");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'legal_signatures_document_id_fkey'
  ) THEN
    ALTER TABLE "legal_signatures"
      ADD CONSTRAINT "legal_signatures_document_id_fkey"
      FOREIGN KEY ("document_id") REFERENCES "legal_documents"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'legal_signatures_created_by_id_fkey'
  ) THEN
    ALTER TABLE "legal_signatures"
      ADD CONSTRAINT "legal_signatures_created_by_id_fkey"
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;
