-- Add date of birth to users. Used (among other things) as the password
-- for employee-facing payslip PDF/Excel downloads (format DDMMYYYY).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS so a partial-apply incident can
-- be re-run safely. Date-only column (no time component).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "date_of_birth" DATE;
