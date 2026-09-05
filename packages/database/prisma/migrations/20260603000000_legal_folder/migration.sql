-- Legal team feedback (Juthamas, May 2026): free-text folder so legal
-- can group documents (e.g. "Token Agreements", "Service Contracts",
-- "NDAs"). Nullable — existing rows stay un-grouped until edited.
-- Idempotent so partial-apply retries are safe.

ALTER TABLE "legal_documents"
  ADD COLUMN IF NOT EXISTS "folder" TEXT;

CREATE INDEX IF NOT EXISTS "legal_documents_folder_idx"
  ON "legal_documents" ("folder");
