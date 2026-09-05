-- Auto-assign default for NEW tasks on shared-board CRM projects (general /
-- hr / product / legal / accounting). Resolved at task-create time. Idempotent
-- + additive (safe DEFAULT backfills existing rows), safe on staging db:push.
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "default_assignee_mode" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "default_assignee_id" UUID;
