-- Helpdesk notification config — singleton row holding the IT-team
-- fan-out recipients + master toggles. Creator + status emails to
-- the requester are hard-wired in code; only the IT-team fan-out is
-- operator-controlled because that's the noisiest channel.
--
-- Idempotent: re-running this migration on a partially-applied DB
-- is safe — the table + unique constraint are gated on IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "helpdesk_settings" (
  "id"                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "singleton"                   BOOLEAN      NOT NULL DEFAULT TRUE,
  "notify_emails"               TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notify_on_create"            BOOLEAN      NOT NULL DEFAULT TRUE,
  "notify_creator_on_create"    BOOLEAN      NOT NULL DEFAULT TRUE,
  "notify_creator_on_status"    BOOLEAN      NOT NULL DEFAULT TRUE,
  "updated_by"                  UUID,
  "created_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Single-row enforcement via UNIQUE on the singleton boolean.
CREATE UNIQUE INDEX IF NOT EXISTS "helpdesk_settings_singleton_key"
  ON "helpdesk_settings" ("singleton");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'helpdesk_settings_updated_by_fkey'
  ) THEN
    ALTER TABLE "helpdesk_settings"
      ADD CONSTRAINT "helpdesk_settings_updated_by_fkey"
      FOREIGN KEY ("updated_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Seed the singleton row so the GET endpoint never has to bootstrap.
INSERT INTO "helpdesk_settings" ("singleton", "notify_emails")
SELECT TRUE, ARRAY[]::TEXT[]
WHERE NOT EXISTS (SELECT 1 FROM "helpdesk_settings");
