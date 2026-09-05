-- Soft delete for HRMS onboarding/offboarding runs (admin/HR duplicate
-- cleanup). A set `deleted_at` hides the run from the list; restorable.
-- Idempotent + additive (no backfill), safe to re-run and to sync to staging
-- via db:push.
ALTER TABLE "onboarding_runs" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "onboarding_runs_deleted_at_idx" ON "onboarding_runs"("deleted_at");

ALTER TABLE "offboarding_runs" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "offboarding_runs_deleted_at_idx" ON "offboarding_runs"("deleted_at");
