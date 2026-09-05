-- Project approval workflow engine.
--
-- Linear chain: Draft -> Pending PM Approval -> Pending Business Head Approval
-- -> Pending Product Admin Approval -> Pending Development -> Completed
-- (any pending stage may be Rejected).
--
-- Additive + reversible. The workflow state lives in a DEDICATED column so the
-- existing board `status` (Kanban / list / dashboard) is untouched; `null`
-- means the project is not in the workflow, which keeps every pre-existing
-- project backward compatible. Idempotent — safe to re-run.

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "workflow_status" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "workflow_updated_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "projects_workflow_status_idx"
  ON "projects" ("workflow_status");

-- Append-only transition history. One row per state change, written in the
-- same transaction as the status update.
CREATE TABLE IF NOT EXISTS "project_workflow_transitions" (
  "id"          TEXT NOT NULL,
  "project_id"  TEXT NOT NULL,
  "from_status" TEXT,
  "to_status"   TEXT NOT NULL,
  "actor_id"    UUID,
  "comment"     TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_workflow_transitions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "project_workflow_transitions_project_id_created_at_idx"
  ON "project_workflow_transitions" ("project_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_workflow_transitions_project_id_fkey'
  ) THEN
    ALTER TABLE "project_workflow_transitions"
      ADD CONSTRAINT "project_workflow_transitions_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
