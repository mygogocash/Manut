-- Project CRM archive (Active / Archived tabs on the shared projects board,
-- mirroring IT CRM's it_projects.archived_at). Additive + idempotent +
-- reversible. Null = active; a set timestamp = archived.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);
CREATE INDEX IF NOT EXISTS "projects_archived_at_idx" ON "projects" ("archived_at");
