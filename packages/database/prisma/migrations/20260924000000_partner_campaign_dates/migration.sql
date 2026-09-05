-- Marketing CRM: campaign cadence columns on partners, shown + inline-edited
-- on the overview. Idempotent so a partial-apply re-run is safe.
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "past_campaign_date" date;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "next_campaign_date" date;
