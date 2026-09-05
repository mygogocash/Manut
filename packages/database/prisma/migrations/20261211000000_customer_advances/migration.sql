-- M3 — Customer advances (overpayment → unapplied credit).
--
-- When a receipt overpays an AR invoice (opt-in), the excess is captured here
-- instead of being rejected. `balance` is the still-unapplied amount; applying
-- it to a later invoice draws it down. Posted (when GL posting is on) against
-- the existing customer_advances mapping role.
--
-- ADDITIVE + IDEMPOTENT (safe to re-run after a P3009 partial apply):
--   * CREATE TABLE / INDEX ... IF NOT EXISTS
--   * fresh table, no back-fill

CREATE TABLE IF NOT EXISTS "customer_advances" (
  "id"                TEXT           NOT NULL,
  "entity_id"         TEXT           NOT NULL,
  "counterparty"      TEXT           NOT NULL,
  "currency"          TEXT           NOT NULL,
  "original_amount"   DECIMAL(15, 2) NOT NULL,
  "balance"           DECIMAL(15, 2) NOT NULL,
  "status"            TEXT           NOT NULL DEFAULT 'open',
  "source_payment_id" TEXT,
  "linked_je_id"      TEXT,
  "notes"             TEXT,
  "created_by"        UUID           NOT NULL,
  "created_at"        TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_advances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "customer_advances_entity_id_status_idx"
  ON "customer_advances" ("entity_id", "status");

CREATE INDEX IF NOT EXISTS "customer_advances_entity_id_counterparty_idx"
  ON "customer_advances" ("entity_id", "counterparty");
