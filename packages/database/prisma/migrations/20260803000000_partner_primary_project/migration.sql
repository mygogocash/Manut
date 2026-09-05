-- Partner CRM detail page redirects into the Projects board UI via
-- a 1:1 backing project. New column is nullable for legacy rows; the
-- `POST /partners/:id/ensure-workspace` endpoint lazily mints one on
-- first visit. Idempotent — safe to re-run.

ALTER TABLE "partners"
  ADD COLUMN IF NOT EXISTS "primary_project_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "partners_primary_project_id_key"
  ON "partners" ("primary_project_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'partners_primary_project_id_fkey'
      AND table_name = 'partners'
  ) THEN
    ALTER TABLE "partners"
      ADD CONSTRAINT "partners_primary_project_id_fkey"
      FOREIGN KEY ("primary_project_id") REFERENCES "projects"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
