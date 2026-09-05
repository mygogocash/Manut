-- Visa records — dependent / family-member holder support (May 2026,
-- Tanatsha feedback):
--
-- HR needs to track visas for employees' dependents (spouse, child)
-- alongside the employee's own visa. Adds three columns:
--   * `holder_type` ('employee' | 'dependent'), default 'employee'.
--   * `holder_name` — display name when the row is a dependent.
--   * `holder_relationship` — free string (spouse / child / parent / …).
--
-- `employee_id` semantics: stays NOT NULL. For dependent rows it
-- points at the SPONSOR employee so the existing reminder cron
-- (which emails the User behind `employee_id`) still routes expiry
-- pings to a TBH inbox without rewriting its query path.
--
-- Migration is idempotent (IF NOT EXISTS).

ALTER TABLE "visa_records"
  ADD COLUMN IF NOT EXISTS "holder_type" TEXT NOT NULL DEFAULT 'employee';
ALTER TABLE "visa_records"
  ADD COLUMN IF NOT EXISTS "holder_name" TEXT;
ALTER TABLE "visa_records"
  ADD COLUMN IF NOT EXISTS "holder_relationship" TEXT;

CREATE INDEX IF NOT EXISTS "visa_records_holder_type_idx"
  ON "visa_records" ("holder_type");
