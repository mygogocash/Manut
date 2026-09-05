-- Phase 2 follow-up — wire DocuSign as an alternate provider on the
-- existing in-house signing flow. Pure additive nullable columns; legacy
-- rows stay on provider="inhouse" with all DocuSign fields NULL.
ALTER TABLE "legal_signatures"
  ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'inhouse',
  ADD COLUMN IF NOT EXISTS "docusign_envelope_id" TEXT,
  ADD COLUMN IF NOT EXISTS "docusign_signer_status" TEXT,
  ADD COLUMN IF NOT EXISTS "signed_pdf_url" TEXT;

-- Partial unique index so we never get two rows pointing at the same
-- DocuSign envelope (would happen if a webhook fires twice and we
-- accidentally insert instead of update). NULLs are allowed for the
-- in-house path.
CREATE UNIQUE INDEX IF NOT EXISTS "legal_signatures_docusign_envelope_id_key"
  ON "legal_signatures"("docusign_envelope_id")
  WHERE "docusign_envelope_id" IS NOT NULL;
