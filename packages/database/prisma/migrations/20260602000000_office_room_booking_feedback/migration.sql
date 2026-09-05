-- Office Room Booking feedback from HR (Tanny, May 2026).
-- Adds room preview image + per-booking attendees / description so HR
-- can see who is in a meeting, why, and what the room looks like before
-- they grab the slot. Idempotent so partial-apply retries are safe.

-- ─── meeting_rooms.image_url ─────────────────────────────
ALTER TABLE "meeting_rooms"
  ADD COLUMN IF NOT EXISTS "image_url" TEXT;

-- ─── room_bookings: description + attendees_count ────────
ALTER TABLE "room_bookings"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "attendees_count" INTEGER;
