-- Phase C pt2: auto-assign default + go-live reminder debounce for the two
-- native-mirror CRMs (Legal, Accounting). Their project rows live in native
-- tables (lazy-mirrored into `projects`, which never copies these), so the
-- columns must live on the native tables — mirroring it_projects. Additive +
-- idempotent (safe to re-run / partial-apply).
ALTER TABLE "legal_projects" ADD COLUMN IF NOT EXISTS "default_assignee_mode" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "legal_projects" ADD COLUMN IF NOT EXISTS "default_assignee_id" UUID;
ALTER TABLE "legal_projects" ADD COLUMN IF NOT EXISTS "reminders_sent" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "legal_projects" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP(3);

ALTER TABLE "accounting_projects" ADD COLUMN IF NOT EXISTS "default_assignee_mode" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "accounting_projects" ADD COLUMN IF NOT EXISTS "default_assignee_id" UUID;
ALTER TABLE "accounting_projects" ADD COLUMN IF NOT EXISTS "reminders_sent" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "accounting_projects" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP(3);
