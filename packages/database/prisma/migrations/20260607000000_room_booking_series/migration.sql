-- Room booking gains multi-day support: one logical reservation can
-- span several days, stored as N rows (one per day) sharing a
-- `series_id`. Single-day bookings stay as standalone rows with
-- `series_id IS NULL`. Idempotent so partial-apply retries are safe.

ALTER TABLE "room_bookings"
  ADD COLUMN IF NOT EXISTS "series_id" UUID;

CREATE INDEX IF NOT EXISTS "room_bookings_series_id_idx"
  ON "room_bookings" ("series_id");
