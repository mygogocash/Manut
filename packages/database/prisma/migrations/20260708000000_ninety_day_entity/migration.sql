-- 90-day notifications — entity scoping (May 2026):
--
-- HR asked for a per-office filter on the Visa Tracker AND the
-- 90 Days Notification of Residence list. Visa records already
-- carry `entity_id`; this migration adds the same nullable FK to
-- `ninety_day_notifications` so the same picker can drive both
-- tables.
--
-- Nullable on purpose: historic rows pre-date the column and we
-- don't have a clean code → entity mapping for them. New writes
-- should populate `entity_id` (UI defaults to "TH" for fresh
-- records since the 90-day filing is Thailand-only today, but the
-- column is left flexible for future BR / IND offices to track
-- analogous compliance windows).

ALTER TABLE "ninety_day_notifications"
  ADD COLUMN IF NOT EXISTS "entity_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ninety_day_notifications_entity_id_fkey'
  ) THEN
    ALTER TABLE "ninety_day_notifications"
      ADD CONSTRAINT "ninety_day_notifications_entity_id_fkey"
      FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "ninety_day_notifications_entity_id_idx"
  ON "ninety_day_notifications" ("entity_id");
