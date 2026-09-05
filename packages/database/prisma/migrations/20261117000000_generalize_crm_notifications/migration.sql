-- Generalize the IT-CRM notification store to serve every CRM: rename
-- it_crm_notifications -> crm_notifications and add a `module` discriminator
-- (existing rows default to 'it'). Guarded so it survives a partial-apply /
-- re-run. On staging (db:push) Prisma reconciles the schema directly.
ALTER TABLE IF EXISTS "it_crm_notifications" RENAME TO "crm_notifications";

ALTER TABLE "crm_notifications"
  ADD COLUMN IF NOT EXISTS "module" TEXT NOT NULL DEFAULT 'it';

ALTER INDEX IF EXISTS "it_crm_notifications_user_id_created_at_idx"
  RENAME TO "crm_notifications_user_id_created_at_idx";
ALTER INDEX IF EXISTS "it_crm_notifications_user_id_read_at_idx"
  RENAME TO "crm_notifications_user_id_read_at_idx";

-- ALTER TABLE ... RENAME TO does NOT rename the PK constraint, so rename it
-- explicitly to match Prisma's derived default (crm_notifications_pkey) and
-- avoid schema drift. Guarded so re-runs are safe (matches the expenses-v1
-- consolidation precedent).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'it_crm_notifications_pkey'
  ) THEN
    ALTER TABLE "crm_notifications"
      RENAME CONSTRAINT "it_crm_notifications_pkey" TO "crm_notifications_pkey";
  END IF;
END $$;
