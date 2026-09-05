-- Wiki pages can carry uploaded files (docs / sheets / PDFs / images
-- / video) alongside the prose. Stored as a JSON array of
-- `{ url, name, mimeType, size }` so we don't need a dedicated
-- `wiki_page_attachments` table for the v1 surface.
--
-- Idempotent: re-running the migration is safe.

ALTER TABLE "wiki_pages"
  ADD COLUMN IF NOT EXISTS "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb;
