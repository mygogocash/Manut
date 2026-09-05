-- 90-day notification: allow "Other" applicants (dependents). Matches
-- the visa-tracker pattern (`holder_type` / `holder_name` / `holder_relationship`).
-- `employee_id` stays NOT NULL — for a dependent row it points to the
-- sponsor employee so the reminder fan-out has somewhere to land.
--
-- Idempotent: each column gated on IF NOT EXISTS.

ALTER TABLE "ninety_day_notifications"
  ADD COLUMN IF NOT EXISTS "holder_type" TEXT NOT NULL DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS "holder_name" TEXT,
  ADD COLUMN IF NOT EXISTS "holder_relationship" TEXT;
