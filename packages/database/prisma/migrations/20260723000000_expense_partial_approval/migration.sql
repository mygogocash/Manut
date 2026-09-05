-- Partial-approval feature for expense reports (HR feedback,
-- 2026-05-22). Approvers can now override the report total at their
-- approval step (e.g. submitter claims 10,000 THB, manager approves
-- 2,500 THB). The per-step amount lives on the decision row; the
-- final value is mirrored into `expense_reports.approved_total` when
-- the last step is approved.
--
-- Both columns are NULL-default and nullable — existing reports keep
-- working unchanged (NULL = approver accepted the running total).
--
-- Idempotent: `ADD COLUMN IF NOT EXISTS` lets this migration survive
-- partial-apply / re-run scenarios on dev / staging.

ALTER TABLE "expense_reports"
  ADD COLUMN IF NOT EXISTS "approved_total" DECIMAL(15, 2);

ALTER TABLE "expense_approval_decisions"
  ADD COLUMN IF NOT EXISTS "approved_amount" DECIMAL(15, 2);
