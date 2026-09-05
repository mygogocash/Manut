-- Phase C pt3: extend the generalized CRM engine to the remaining CRMs.
-- Product (native-mirror board like Legal/Accounting): auto-assign default +
-- go-live reminder debounce on the native project row. QA (pure-native
-- workspace): the same on qa_projects (deadline = end_date), plus task-level
-- debounce on qa_project_tasks because QA tasks live ONLY natively. Sales /
-- Sales Revenue to-do tasks get due-date reminder debounce. Additive +
-- idempotent (safe to re-run / partial-apply).
ALTER TABLE "product_projects" ADD COLUMN IF NOT EXISTS "default_assignee_mode" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "product_projects" ADD COLUMN IF NOT EXISTS "default_assignee_id" UUID;
ALTER TABLE "product_projects" ADD COLUMN IF NOT EXISTS "reminders_sent" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "product_projects" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP(3);

ALTER TABLE "qa_projects" ADD COLUMN IF NOT EXISTS "default_assignee_mode" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "qa_projects" ADD COLUMN IF NOT EXISTS "default_assignee_id" UUID;
ALTER TABLE "qa_projects" ADD COLUMN IF NOT EXISTS "reminders_sent" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "qa_projects" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP(3);

ALTER TABLE "qa_project_tasks" ADD COLUMN IF NOT EXISTS "reminders_sent" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "qa_project_tasks" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP(3);

ALTER TABLE "crm_tasks" ADD COLUMN IF NOT EXISTS "reminders_sent" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "crm_tasks" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP(3);

ALTER TABLE "revenue_tasks" ADD COLUMN IF NOT EXISTS "reminders_sent" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "revenue_tasks" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP(3);
