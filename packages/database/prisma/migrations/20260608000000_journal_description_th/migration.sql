-- Bilingual journal entries: add a Thai-side description column alongside
-- the existing (English) `description`. HR/admin imports the GL twice —
-- once per language — and the importer upserts by (entityId, reference)
-- to populate whichever column matches the chosen language. The Journal
-- Entries UI then surfaces a language toggle so reviewers can flip
-- between the two without re-importing.
ALTER TABLE "journal_entries"
  ADD COLUMN IF NOT EXISTS "description_th" TEXT;
