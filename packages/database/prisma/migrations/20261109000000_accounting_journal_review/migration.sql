ALTER TABLE "journal_entries"
  ADD COLUMN IF NOT EXISTS "rejected_by" UUID,
  ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reject_reason" TEXT;

DO $$
BEGIN
  ALTER TABLE "journal_entries"
    ADD CONSTRAINT "journal_entries_rejected_by_fkey"
    FOREIGN KEY ("rejected_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
