-- Room booking now supports 15/30 min slots — admins can pick a start
-- + duration instead of being forced to one-hour bookings. Adds an
-- explicit end_time column so overlap detection can replace the rigid
-- @unique([roomId, date, timeSlot]) constraint.
--
-- Idempotent so partial-apply retries are safe.

-- 1. Add end_time. Nullable so backfill can populate without violating
--    the column. Backfilled rows get start + 60 minutes to preserve
--    the legacy one-hour semantic.
ALTER TABLE "room_bookings"
  ADD COLUMN IF NOT EXISTS "end_time" TEXT;

UPDATE "room_bookings"
SET "end_time" = TO_CHAR(
  (TO_TIMESTAMP("time_slot", 'HH24:MI') + INTERVAL '1 hour'),
  'HH24:MI'
)
WHERE "end_time" IS NULL;

-- 2. Drop the strict unique constraint — variable-duration bookings
--    can't be deduped by exact slot match anymore. Overlap is enforced
--    in application code via a range query.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'room_bookings_room_id_date_time_slot_key'
  ) THEN
    ALTER TABLE "room_bookings"
      DROP CONSTRAINT "room_bookings_room_id_date_time_slot_key";
  END IF;
END $$;

-- 3. Index the lookup columns we hit on every list / overlap query.
CREATE INDEX IF NOT EXISTS "room_bookings_room_id_date_idx"
  ON "room_bookings" ("room_id", "date");
