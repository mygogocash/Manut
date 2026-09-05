-- Expense approval chain — reviewer stage. Adds a `stage_role` discriminator
-- to both the chain-config step table and the per-report decision snapshot.
-- `review` = validate-only gate (advances the chain, never finalises, cannot
-- reduce the approved amount); `approve` = final-sign-off gate (today's
-- behaviour). Defaults to `approve` so every pre-existing step and in-flight
-- decision keeps its current meaning — a behavioural no-op on apply.
-- Additive + idempotent.
ALTER TABLE "expense_approval_steps"
  ADD COLUMN IF NOT EXISTS "stage_role" TEXT NOT NULL DEFAULT 'approve';

ALTER TABLE "expense_approval_decisions"
  ADD COLUMN IF NOT EXISTS "stage_role" TEXT NOT NULL DEFAULT 'approve';
