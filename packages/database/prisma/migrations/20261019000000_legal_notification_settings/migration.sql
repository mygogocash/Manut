-- Legal notification settings (2026-06-12): per-category alert toggles +
-- a configurable team recipient list, plus an alert-category tag on
-- documents. Idempotent (CLAUDE.md): safe to re-run.

ALTER TABLE "legal_documents" ADD COLUMN IF NOT EXISTS "alert_category" TEXT;

CREATE TABLE IF NOT EXISTS "legal_notification_settings" (
  "id"                          UUID NOT NULL DEFAULT gen_random_uuid(),
  "singleton"                   BOOLEAN NOT NULL DEFAULT true,
  "recipients"                  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notify_contract_expiry"      BOOLEAN NOT NULL DEFAULT true,
  "notify_contract_review"      BOOLEAN NOT NULL DEFAULT true,
  "notify_initial_drafting"     BOOLEAN NOT NULL DEFAULT true,
  "notify_licence_renewal"      BOOLEAN NOT NULL DEFAULT true,
  "notify_compliance_filing"    BOOLEAN NOT NULL DEFAULT true,
  "notify_counterparty_review"  BOOLEAN NOT NULL DEFAULT true,
  "updated_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_notification_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "legal_notification_settings_singleton_key"
  ON "legal_notification_settings" ("singleton");
