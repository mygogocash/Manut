-- Close-date reminder debounce for Sales / Sales Revenue opportunities.
-- The generalized CRM deadline cron scans open-stage opportunities whose
-- closeDate is inside the ladder horizon and stamps fired rungs here
-- ("close-30/14/7/1" + "close-overdue"); a closeDate edit re-arms.
-- Additive + idempotent (safe to re-run / partial-apply).
ALTER TABLE "crm_opportunities" ADD COLUMN IF NOT EXISTS "reminders_sent" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "crm_opportunities" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP(3);

ALTER TABLE "revenue_opportunities" ADD COLUMN IF NOT EXISTS "reminders_sent" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "revenue_opportunities" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP(3);
