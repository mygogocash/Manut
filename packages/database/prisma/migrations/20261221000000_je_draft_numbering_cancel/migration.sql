-- PRD 2 overlay — journal draft numbers and period-aware cancel/reverse.
-- Additive nullable columns; safe to re-run. Staging applies schema via
-- `pnpm db:push`, so this file is for migrate-using environments only.

ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "draft_no" TEXT;
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "cancelled_by" UUID;
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT;
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "reversed_by_entry_id" TEXT;
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "reverses_entry_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_reversed_by_entry_id_key"
  ON "journal_entries" ("reversed_by_entry_id");
CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_reverses_entry_id_key"
  ON "journal_entries" ("reverses_entry_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_cancelled_by_fkey'
  ) THEN
    ALTER TABLE "journal_entries"
      ADD CONSTRAINT "journal_entries_cancelled_by_fkey"
      FOREIGN KEY ("cancelled_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_reversed_by_entry_id_fkey'
  ) THEN
    ALTER TABLE "journal_entries"
      ADD CONSTRAINT "journal_entries_reversed_by_entry_id_fkey"
      FOREIGN KEY ("reversed_by_entry_id") REFERENCES "journal_entries"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_reverses_entry_id_fkey'
  ) THEN
    ALTER TABLE "journal_entries"
      ADD CONSTRAINT "journal_entries_reverses_entry_id_fkey"
      FOREIGN KEY ("reverses_entry_id") REFERENCES "journal_entries"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
