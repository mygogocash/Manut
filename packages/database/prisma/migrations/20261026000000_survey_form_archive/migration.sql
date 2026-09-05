-- Add an archive flag to survey forms (orthogonal to status). Idempotent so
-- it survives a partial-apply / re-run, and matches what `db:push` already
-- synced on staging.
ALTER TABLE "survey_forms" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "survey_forms_archived_at_idx" ON "survey_forms"("archived_at");
