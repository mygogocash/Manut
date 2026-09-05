-- Payroll run details now keep two extra dimensions of state:
--   1. Payslip-level snapshots of Position / Department / Start Date,
--      sourced from HR's xlsx. Previously the Run Details sheet joined
--      the live `users` row, so contractor placeholders (no jobTitle /
--      department / startDate on User) rendered "—" even when the
--      spreadsheet supplied the values.
--   2. Per-currency totals on the run. The headline totalGross /
--      totalTax / totalNet columns were a naive numerical sum across
--      every payslip — including USD / INR contractors paid through a
--      THB entity — which made the take-home figure meaningless. The
--      new `currency_totals` JSON column stores `{ [ccy]: { gross,
--      tax, net, count } }`; headline columns are recomputed against
--      the entity's currency only.
--
-- All columns nullable + idempotent so a partial-apply incident
-- re-runs cleanly.

ALTER TABLE "payslips"
  ADD COLUMN IF NOT EXISTS "position_snapshot"   TEXT,
  ADD COLUMN IF NOT EXISTS "department_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "start_date_snapshot" TEXT;

ALTER TABLE "payroll_runs"
  ADD COLUMN IF NOT EXISTS "currency_totals" JSONB;
