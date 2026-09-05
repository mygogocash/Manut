-- Certificate soft-delete (revert / restore / permanent). A reversible
-- deleted_at timestamp so admin/HR can revert an issued certificate (hiding it
-- from the active list while keeping the stored PDF) and restore it later, or
-- delete it permanently. Additive + idempotent + table-guarded.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'certificates'
  ) THEN
    ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
    CREATE INDEX IF NOT EXISTS "certificates_deleted_at_idx" ON "certificates" ("deleted_at");
  END IF;
END $$;
