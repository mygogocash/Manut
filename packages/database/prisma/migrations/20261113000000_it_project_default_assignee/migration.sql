-- IT CRM auto-assign default: a per-project rule for who a new task's owner
-- defaults to when the creator leaves it blank. Resolved at task-create time.
-- Idempotent + additive (no backfill), so it is safe to re-run and syncs to
-- staging via `db:push`. `default_assignee_id` is a plain user id (no FK),
-- validated in the service before use.
ALTER TABLE "it_projects"
  ADD COLUMN IF NOT EXISTS "default_assignee_mode" TEXT NOT NULL DEFAULT 'none';

ALTER TABLE "it_projects"
  ADD COLUMN IF NOT EXISTS "default_assignee_id" UUID;
