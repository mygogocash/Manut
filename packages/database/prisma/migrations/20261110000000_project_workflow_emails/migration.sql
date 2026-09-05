-- Email-driven approval notifications for the project request workflow.
--
-- Adds the request `priority` (surfaced to approvers in every email) and the
-- delivery log. `idempotency_key` is UNIQUE and claimed before a send is
-- attempted, which is what makes duplicate emails impossible even under
-- replayed or concurrent triggers.
--
-- Additive + reversible + idempotent — safe to re-run.

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "priority" TEXT;

CREATE TABLE IF NOT EXISTS "project_workflow_emails" (
  "id"              TEXT NOT NULL,
  "project_id"      TEXT NOT NULL,
  "transition_id"   TEXT,
  "stage"           TEXT NOT NULL,
  "kind"            TEXT NOT NULL,
  "recipient"       TEXT NOT NULL,
  "subject"         TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "attempts"        INTEGER NOT NULL DEFAULT 0,
  "error"           TEXT,
  "idempotency_key" TEXT NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at"         TIMESTAMPTZ(6),
  CONSTRAINT "project_workflow_emails_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_workflow_emails_idempotency_key_key"
  ON "project_workflow_emails" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "project_workflow_emails_project_id_created_at_idx"
  ON "project_workflow_emails" ("project_id", "created_at");
CREATE INDEX IF NOT EXISTS "project_workflow_emails_status_idx"
  ON "project_workflow_emails" ("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_workflow_emails_project_id_fkey'
  ) THEN
    ALTER TABLE "project_workflow_emails"
      ADD CONSTRAINT "project_workflow_emails_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
