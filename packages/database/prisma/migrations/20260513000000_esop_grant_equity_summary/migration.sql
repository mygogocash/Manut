-- Extend esop_grants to model the Equity Summary Report:
-- multi-component grants (tokens, equity, sign-up bonus, CXO, golden
-- handcuff, annual-review uplift), currency- or percent-denominated
-- values, and monthly recurring allocations.

ALTER TABLE "esop_grants"
  ADD COLUMN IF NOT EXISTS "grant_type"             TEXT NOT NULL DEFAULT 'equity',
  ADD COLUMN IF NOT EXISTS "value_type"             TEXT NOT NULL DEFAULT 'shares',
  ADD COLUMN IF NOT EXISTS "currency_code"          TEXT,
  ADD COLUMN IF NOT EXISTS "currency_amount"        NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS "percent_of_base"        NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS "allocation_mode"        TEXT NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS "monthly_amount"         NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS "allocation_start_month" DATE,
  ADD COLUMN IF NOT EXISTS "allocation_end_month"   DATE,
  ADD COLUMN IF NOT EXISTS "source"                 TEXT;

-- Make shares + strike_price optional-by-default so currency/percent
-- grants don't have to fabricate a number. Existing rows keep their
-- values; only future inserts that omit the column see the default.
ALTER TABLE "esop_grants" ALTER COLUMN "shares"       SET DEFAULT 0;
ALTER TABLE "esop_grants" ALTER COLUMN "strike_price" SET DEFAULT 0;
