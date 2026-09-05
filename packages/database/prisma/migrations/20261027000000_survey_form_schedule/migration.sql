-- Optional open/close window for survey forms. Idempotent so it survives a
-- partial-apply / re-run, and matches what `db:push` synced on staging.
ALTER TABLE "survey_forms" ADD COLUMN IF NOT EXISTS "start_date" DATE;
ALTER TABLE "survey_forms" ADD COLUMN IF NOT EXISTS "end_date" DATE;

CREATE INDEX IF NOT EXISTS "survey_forms_end_date_idx" ON "survey_forms"("end_date");
