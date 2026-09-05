-- Allowance flag on expense categories. Allowance reports (Thailand
-- Travel, Phone Bill, etc.) bypass the manager-approval chain on
-- submit and short-circuit to `reimbursed`; the finance-desk
-- recipients receive an FYI summary email instead of someone having
-- to action the report in the portal.
--
-- Idempotent: re-running on a partial-apply is a no-op.

ALTER TABLE "expense_categories"
  ADD COLUMN IF NOT EXISTS "is_allowance" BOOLEAN NOT NULL DEFAULT false;
