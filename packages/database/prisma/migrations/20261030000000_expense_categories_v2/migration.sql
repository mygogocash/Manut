-- Expense Management category overhaul (v2)
--   * report-level `category` collapsed to three keys
--   * per-line `sub_type` tag for Business-Trip line items
--   * `is_office_filed` flag decouples submitter-masking from the (now
--     default) office_admin_expense category
-- Idempotent: guarded so it is safe to re-run / survives a partial apply.

-- 1. New columns ----------------------------------------------------------
ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "sub_type" TEXT;

ALTER TABLE "expense_reports"
  ADD COLUMN IF NOT EXISTS "is_office_filed" BOOLEAN NOT NULL DEFAULT false;

-- 2. Preserve masking for genuine office-filed rows BEFORE the 'office'
--    key is remapped away. Legacy office reports keep their anonymity;
--    everything else (incl. the old 'general' default) shows real names.
UPDATE "expense_reports"
  SET "is_office_filed" = true
  WHERE "category" = 'office';

-- 3. Remap report category keys to the new 3-category set.
UPDATE "expense_reports" SET "category" = 'business_trip_expense'
  WHERE "category" = 'business_or_bd';
UPDATE "expense_reports" SET "category" = 'monthly_payroll_allowances'
  WHERE "category" = 'allowance';
UPDATE "expense_reports" SET "category" = 'office_admin_expense'
  WHERE "category" IN ('office', 'general');

-- 4. New default for freshly-created reports.
ALTER TABLE "expense_reports"
  ALTER COLUMN "category" SET DEFAULT 'office_admin_expense';

-- 5. Remap the same keys inside approval-step category_filter JSON arrays.
--    Quoted tokens so "office" never matches inside "office_admin_expense".
UPDATE "expense_approval_steps"
  SET "category_filter" = REPLACE(REPLACE(REPLACE(REPLACE(
        "category_filter"::text,
        '"business_or_bd"', '"business_trip_expense"'),
        '"allowance"',      '"monthly_payroll_allowances"'),
        '"office"',         '"office_admin_expense"'),
        '"general"',        '"office_admin_expense"')::jsonb
  WHERE "category_filter"::text ~ '("business_or_bd"|"allowance"|"office"|"general")';
