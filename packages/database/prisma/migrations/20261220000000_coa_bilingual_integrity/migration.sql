-- PRD 1 — Chart of Accounts bilingual completeness + active uniqueness.
-- Additive columns; uniqueness among ACTIVE rows only so an inactive code
-- may be reused. Safe to re-run.

ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "description_th" TEXT;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "name_normalized" TEXT;

UPDATE "chart_of_accounts"
SET "name_normalized" = lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
WHERE "name_normalized" IS NULL AND name IS NOT NULL;

CREATE INDEX IF NOT EXISTS "chart_of_accounts_entity_id_code_idx"
  ON "chart_of_accounts" ("entity_id", "code");

CREATE INDEX IF NOT EXISTS "chart_of_accounts_entity_id_name_normalized_idx"
  ON "chart_of_accounts" ("entity_id", "name_normalized");

-- 0000_init created this as a UNIQUE INDEX, not a table constraint.
-- DROP CONSTRAINT alone would no-op and leave the old unique in place,
-- blocking inactive-code reuse. Try constraint first (if a later env
-- promoted it), then the index.
ALTER TABLE "chart_of_accounts"
  DROP CONSTRAINT IF EXISTS "chart_of_accounts_entity_id_code_key";
DROP INDEX IF EXISTS "chart_of_accounts_entity_id_code_key";

CREATE UNIQUE INDEX IF NOT EXISTS "chart_of_accounts_entity_code_active"
  ON "chart_of_accounts" ("entity_id", "code")
  WHERE is_active = true AND deleted_at IS NULL;
