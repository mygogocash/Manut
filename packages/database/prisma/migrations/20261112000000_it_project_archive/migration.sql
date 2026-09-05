-- Add a reversible archive flag to IT CRM projects (orthogonal to `status`).
-- A set `archived_at` hides the project from the default IT CRM list (Active
-- tab) while preserving its real status; null = active. Idempotent so it
-- survives a partial-apply / re-run, and matches what `db:push` already synced
-- on staging (pure additive column — no backfill).
ALTER TABLE "it_projects" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "it_projects_archived_at_idx" ON "it_projects"("archived_at");
