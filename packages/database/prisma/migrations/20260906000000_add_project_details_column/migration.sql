-- Legal-team feedback (2026-05-26): add a long-form `details` field
-- on the shared `projects` table so Legal Tasks can carry counterparty
-- notes / deal mechanics / drive links alongside the short
-- `description`. Postgres TEXT, nullable; non-Legal teams ignore it.

ALTER TABLE "projects"
    ADD COLUMN IF NOT EXISTS "details" TEXT;
