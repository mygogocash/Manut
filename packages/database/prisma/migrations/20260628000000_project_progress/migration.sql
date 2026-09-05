-- Manual progress (0-100) on Project. Was previously a virtual field
-- on the API response that always rendered 0% in the UI; the Projects
-- list now exposes inline editing, so we persist it for real. Idempotent
-- ADD COLUMN so partial-apply incidents survive a re-run.
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "progress" INTEGER NOT NULL DEFAULT 0;
