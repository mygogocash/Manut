-- Visa Management + Travel Request feedback from HR (Tanny, May 2026).
-- Idempotent so it survives partial-apply retries.

-- ─── users.nationality ───────────────────────────────────
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "nationality" TEXT;

-- ─── visa_records: nationality, work permit, multi-doc, reminder ──
ALTER TABLE "visa_records"
  ADD COLUMN IF NOT EXISTS "nationality" TEXT,
  ADD COLUMN IF NOT EXISTS "work_permit_number" TEXT,
  ADD COLUMN IF NOT EXISTS "work_permit_issue_date" DATE,
  ADD COLUMN IF NOT EXISTS "work_permit_expiry_date" DATE,
  ADD COLUMN IF NOT EXISTS "documents" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "visa_records_work_permit_expiry_date_idx"
  ON "visa_records" ("work_permit_expiry_date");

-- ─── travel_requests: booking preferences ────────────────
ALTER TABLE "travel_requests"
  ADD COLUMN IF NOT EXISTS "departure_time_preference" TEXT,
  ADD COLUMN IF NOT EXISTS "return_time_preference" TEXT,
  ADD COLUMN IF NOT EXISTS "meal_preference" TEXT,
  ADD COLUMN IF NOT EXISTS "seating_preference" TEXT,
  ADD COLUMN IF NOT EXISTS "seating_preference_other" TEXT,
  ADD COLUMN IF NOT EXISTS "dummy_ticket_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "visa_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "hotel_location_preference" TEXT,
  ADD COLUMN IF NOT EXISTS "preferred_hotel" TEXT;
