-- BD-feedback round 3 — Account-level engagement tracking.
-- Adds 10 nullable columns: PIC name + designation + department,
-- four engagement dates (last follow-up / agreement signed /
-- UAT start / UAT end), engagement type, blocker text, remarks.
-- Idempotent ADD COLUMN IF NOT EXISTS so partial-apply incidents
-- survive a re-run.
ALTER TABLE "crm_accounts"
  ADD COLUMN IF NOT EXISTS "pic_name"              TEXT,
  ADD COLUMN IF NOT EXISTS "designation"           TEXT,
  ADD COLUMN IF NOT EXISTS "department"            TEXT,
  ADD COLUMN IF NOT EXISTS "last_follow_up_date"   DATE,
  ADD COLUMN IF NOT EXISTS "agreement_signed_date" DATE,
  ADD COLUMN IF NOT EXISTS "engagement_type"       TEXT,
  ADD COLUMN IF NOT EXISTS "uat_start_date"        DATE,
  ADD COLUMN IF NOT EXISTS "uat_end_date"          DATE,
  ADD COLUMN IF NOT EXISTS "blocker"               TEXT,
  ADD COLUMN IF NOT EXISTS "remarks"               TEXT;
