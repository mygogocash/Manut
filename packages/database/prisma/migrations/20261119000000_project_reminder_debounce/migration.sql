-- Deadline-reminder debounce state for shared-board CRMs (Project / HR) whose
-- projects live directly in `projects` (no native mirror). Mirrors the
-- `it_projects.reminders_sent` / `last_reminder_sent_at` columns so the
-- generalized CRM deadline cron can ladder + debounce go-live reminders on
-- these rows too. Additive + idempotent (safe to re-run / partial-apply).
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "reminders_sent" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP(3);
