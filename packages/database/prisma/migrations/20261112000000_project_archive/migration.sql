-- Project archiving, exercised by the Project Manager (workflow owner).
-- Archived projects become read-only for every role. Additive, nullable,
-- reversible and idempotent — no existing row or column is affected.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);
CREATE INDEX IF NOT EXISTS "projects_archived_at_idx" ON "projects" ("archived_at");
