-- HR's "Equity Monthly Salary" sheet. Per-employee, per-year, with the
-- monthly share counts stored as a JSON map keyed by three-letter
-- month abbrev. Idempotent CREATE TABLE so partial-apply incidents
-- survive a re-run.
CREATE TABLE IF NOT EXISTS "equity_monthly_salary" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "employee_name"  TEXT         NOT NULL,
  "position"       TEXT,
  "start_date"     DATE,
  "currency"       TEXT,
  "year"           INTEGER      NOT NULL,
  "monthly_shares" JSONB        NOT NULL DEFAULT '{}',
  "notes"          TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "equity_monthly_salary_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "equity_monthly_salary_year_idx"
  ON "equity_monthly_salary" ("year");
