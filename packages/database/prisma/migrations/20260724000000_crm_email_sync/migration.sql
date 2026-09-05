-- CRM email auto-sync (Sid + BD feedback, 2026-05-24). Add the
-- cursor that the cron worker advances after each Gmail scan, and a
-- unique dedup key on CrmActivity so re-runs don't double-log.
--
-- Idempotent on partial-apply / re-run: both ADD COLUMN statements
-- use IF NOT EXISTS, and the unique index uses IF NOT EXISTS too.

ALTER TABLE "user_google_connections"
  ADD COLUMN IF NOT EXISTS "last_crm_email_sync_at" TIMESTAMP(3);

ALTER TABLE "crm_activities"
  ADD COLUMN IF NOT EXISTS "external_ref" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "crm_activities_external_ref_key"
  ON "crm_activities"("external_ref");
