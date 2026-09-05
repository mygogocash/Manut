-- Multi-signer envelopes — relax the per-row unique on
-- `docusign_envelope_id` (multiple LegalSignature rows can share an
-- envelope id, one per recipient) and add a `signing_order` column so
-- the UI / DocuSign know which signer goes first. Idempotent.

ALTER TABLE "legal_signatures"
  ADD COLUMN IF NOT EXISTS "signing_order" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "legal_signatures_docusign_envelope_id_key";

CREATE INDEX IF NOT EXISTS "legal_signatures_docusign_envelope_id_idx"
  ON "legal_signatures"("docusign_envelope_id");

-- New composite unique to keep dedup: an envelope can have at most
-- one row per signer email. Partial — NULL envelope ids (in-house
-- flow) are exempt.
DROP INDEX IF EXISTS "legal_signatures_envelope_email_key";
CREATE UNIQUE INDEX "legal_signatures_envelope_email_key"
  ON "legal_signatures"("docusign_envelope_id", "signer_email")
  WHERE "docusign_envelope_id" IS NOT NULL;
