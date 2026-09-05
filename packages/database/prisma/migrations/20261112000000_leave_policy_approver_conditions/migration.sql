-- Per-step conditions on the per-leave-type approver chain (LeavePolicyApprover).
-- Mirrors LeaveApprovalStep submitter gating, plus a whole-day band on the
-- request's `days`. Pure additive DDL with DB-level defaults / nullable columns:
-- no data backfill, safe to re-run, and reaches staging via `db:push`.
ALTER TABLE "leave_policy_approvers"
  ADD COLUMN IF NOT EXISTS "skip_when_submitter_ids" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "only_when_submitter_ids" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "min_days" INTEGER,
  ADD COLUMN IF NOT EXISTS "max_days" INTEGER;
