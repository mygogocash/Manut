-- Projects — BD round #2 column-type spec:
--
-- `production_live` (boolean) is retyped to a date so BD can record
-- WHEN a project actually went live in production, not just a
-- yes/no flag. NULL means "not yet live".
--
-- Migration is idempotent: ADD … IF NOT EXISTS + DROP … IF EXISTS
-- both survive partial-apply incidents.

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "production_live_date" DATE;

-- Carry forward the boolean: any row currently marked `production_live = true`
-- gets `production_live_date = updated_at::date` as a best-effort estimate
-- of when it went live. `false` rows stay NULL (= not yet live).
UPDATE "projects"
SET    "production_live_date" = "updated_at"::date
WHERE  "production_live_date" IS NULL
  AND  "production_live" = true;

ALTER TABLE "projects"
  DROP COLUMN IF EXISTS "production_live";
