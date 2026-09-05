-- Validator node alerts (May 2026):
--
-- IT-managed alert rules that watch metrics on the BnryMainnet
-- validator report and email a recipient when thresholds breach.
--
-- One row per rule. `node_id` nullable so a rule can target one
-- validator or every validator. `last_triggered_at` + `cooldown_minutes`
-- prevent the every-5-min report fetch from re-emailing the same
-- breach repeatedly.
--
-- Migration is idempotent via IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "validator_node_alerts" (
  "id"                UUID            NOT NULL DEFAULT gen_random_uuid(),
  "name"              VARCHAR(120)    NOT NULL,
  "node_id"           TEXT,
  "field"             TEXT            NOT NULL,
  "operator"          TEXT            NOT NULL,
  "threshold"         DECIMAL(28, 8)  NOT NULL,
  "email"             VARCHAR(255)    NOT NULL,
  "enabled"           BOOLEAN         NOT NULL DEFAULT TRUE,
  "cooldown_minutes"  INTEGER         NOT NULL DEFAULT 1440,
  "last_triggered_at" TIMESTAMP(3),
  "created_by"        UUID            NOT NULL,
  "created_at"        TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3)    NOT NULL,

  CONSTRAINT "validator_node_alerts_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "validator_node_alerts"
    ADD CONSTRAINT "validator_node_alerts_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "validator_node_alerts_enabled_idx"
  ON "validator_node_alerts" ("enabled");

CREATE INDEX IF NOT EXISTS "validator_node_alerts_node_id_idx"
  ON "validator_node_alerts" ("node_id");
