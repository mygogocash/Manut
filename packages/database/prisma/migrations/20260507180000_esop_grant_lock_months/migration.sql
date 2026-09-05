-- HRMS ESOP — admin-defined lock period (months) on each grant. Pure
-- additive; legacy grants default to 0 = no lock.
ALTER TABLE "esop_grants"
  ADD COLUMN IF NOT EXISTS "lock_months" INTEGER NOT NULL DEFAULT 0;
