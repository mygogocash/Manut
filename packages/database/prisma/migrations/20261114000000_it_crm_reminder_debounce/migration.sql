-- Deadline-reminder debounce ladder for IT CRM. `reminders_sent` records the
-- rung markers already fired for a project's go-live / a task's due date so the
-- daily cron is idempotent (re-running the same day is a no-op). Additive +
-- idempotent (no backfill), safe to re-run and to sync to staging via db:push.
ALTER TABLE "it_projects"
  ADD COLUMN IF NOT EXISTS "reminders_sent" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "it_projects"
  ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP(3);

-- Task deadlines are tracked on the shared project_tasks table (the live
-- writer for IT tasks); the cron scans it WHERE project.team = 'it'.
ALTER TABLE "project_tasks"
  ADD COLUMN IF NOT EXISTS "reminders_sent" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "project_tasks"
  ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP(3);
