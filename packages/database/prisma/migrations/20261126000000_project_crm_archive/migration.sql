-- Project CRM board archive (Active / Archived, mirrors IT CRM). Reversible
-- archived_at timestamp on the shared projects board (general / hr / legal /
-- accounting / product / it live here). Additive + idempotent + table-guarded.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'projects'
  ) THEN
    ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);
    CREATE INDEX IF NOT EXISTS "projects_archived_at_idx" ON "projects" ("archived_at");
  END IF;
END $$;
