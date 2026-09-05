-- Track the last milestone (in days-to-expiry) that we fired a reminder
-- for, so the cron can re-ping when the record crosses into a closer
-- bucket (90 -> 60 -> 30 -> 14 -> 7). Idempotent.

ALTER TABLE "visa_records"
  ADD COLUMN IF NOT EXISTS "last_reminder_milestone_days" INTEGER;
