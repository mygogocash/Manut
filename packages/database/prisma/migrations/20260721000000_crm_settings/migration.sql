-- Sales CRM notification config — singleton row holding the CRM
-- team fan-out recipients + master toggles. Replaces the
-- CRM_NOTIFICATION_EMAILS env var that previously drove opportunity
-- created / stage-changed emails. Mirrors the helpdesk_settings
-- table shipped in 20260711000000_helpdesk_settings.
--
-- Idempotent: re-running on a partially-applied DB is safe — the
-- table + unique constraint + foreign key + seed row are all gated.

CREATE TABLE IF NOT EXISTS "crm_settings" (
  "id"                              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "singleton"                       BOOLEAN      NOT NULL DEFAULT TRUE,
  "notify_emails"                   TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notify_on_create"                BOOLEAN      NOT NULL DEFAULT TRUE,
  "notify_owner_on_create"          BOOLEAN      NOT NULL DEFAULT TRUE,
  "notify_owner_on_stage_change"    BOOLEAN      NOT NULL DEFAULT TRUE,
  "updated_by"                      UUID,
  "created_at"                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Single-row enforcement via UNIQUE on the singleton boolean.
CREATE UNIQUE INDEX IF NOT EXISTS "crm_settings_singleton_key"
  ON "crm_settings" ("singleton");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'crm_settings_updated_by_fkey'
  ) THEN
    ALTER TABLE "crm_settings"
      ADD CONSTRAINT "crm_settings_updated_by_fkey"
      FOREIGN KEY ("updated_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Seed the singleton row so the GET endpoint never has to bootstrap.
INSERT INTO "crm_settings" ("singleton", "notify_emails")
SELECT TRUE, ARRAY[]::TEXT[]
WHERE NOT EXISTS (SELECT 1 FROM "crm_settings");
