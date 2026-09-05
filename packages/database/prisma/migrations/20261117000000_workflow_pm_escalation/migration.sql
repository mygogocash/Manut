-- PM-gated escalation.
--
-- The approval chain no longer routes every request through fixed Business Head
-- and Product Admin stages. The Project Manager is the single gate: approving
-- releases the work, and when another owner's sign-off is genuinely needed the
-- PM escalates to a NAMED person. That person is recorded here.
--
-- A scalar rather than a foreign key relation, matching `project_workflow_
-- transitions.actor_id`: this is an audit-style pointer, and a real FK would add
-- a third projects->users relation for no gain.
--
-- Also migrates any row still sitting in one of the retired stages. Both fold
-- to `pending_escalation` — they were awaiting a sign-off above the PM, which is
-- exactly what the new stage means. `escalated_to_id` is left null for those, so
-- the PM re-names a target; guessing one would fabricate an approver.
--
-- Idempotent: safe to re-run.

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "escalated_to_id" uuid;

-- Only useful for "what is waiting on me", which filters on it.
CREATE INDEX IF NOT EXISTS "projects_escalated_to_id_idx"
  ON "projects" ("escalated_to_id")
  WHERE "escalated_to_id" IS NOT NULL;

UPDATE "projects"
SET "workflow_status" = 'pending_escalation'
WHERE "workflow_status" IN (
  'pending_business_head_approval',
  'pending_product_admin_approval'
);

-- The transition log is append-only history and is deliberately NOT rewritten:
-- those rows record what actually happened under the previous chain. The UI
-- prettifies unknown status keys, so retired stage names still read sensibly.
