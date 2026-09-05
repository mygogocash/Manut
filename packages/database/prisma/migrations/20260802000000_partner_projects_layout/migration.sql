-- Partner CRM list adopts the Projects dashboard layout (#534).
-- Adds: tracking dates (production live / go live / revised go live),
-- dependency + comment notes, manual ordering, owning user FK, and
-- owning department. All optional; existing rows stay valid.
-- Idempotent — safe to re-run if a deploy half-applied.

ALTER TABLE "partners"
  ADD COLUMN IF NOT EXISTS "production_live_date" DATE,
  ADD COLUMN IF NOT EXISTS "go_live_date" DATE,
  ADD COLUMN IF NOT EXISTS "revised_go_live_date" DATE,
  ADD COLUMN IF NOT EXISTS "dependency" TEXT,
  ADD COLUMN IF NOT EXISTS "comment" TEXT,
  ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "owner_id" UUID,
  ADD COLUMN IF NOT EXISTS "department" TEXT;

CREATE INDEX IF NOT EXISTS "partners_sort_order_idx" ON "partners" ("sort_order");
CREATE INDEX IF NOT EXISTS "partners_owner_id_idx"   ON "partners" ("owner_id");
CREATE INDEX IF NOT EXISTS "partners_department_idx" ON "partners" ("department");

-- FK on owner_id (SET NULL on user delete — partners outlive owners).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'partners_owner_id_fkey'
      AND table_name = 'partners'
  ) THEN
    ALTER TABLE "partners"
      ADD CONSTRAINT "partners_owner_id_fkey"
      FOREIGN KEY ("owner_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
