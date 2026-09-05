-- M9 — Persisted tax filings + tax-month lock.
--
-- Today the VAT/PP.30/PND registers are computed on demand and nothing is
-- "filed". This adds a tax_filings table: one row per (entity, filing_type,
-- year, month). A row with status 'filed' LOCKS the tax month — the service
-- rejects creating/editing an AR/AP document dated into it until an admin
-- reopens it (status 'reopened'). `snapshot` stores the register totals at
-- filing time for the audit trail.
--
-- ADDITIVE + IDEMPOTENT (safe to re-run after a P3009 partial apply):
--   * CREATE TABLE / INDEX ... IF NOT EXISTS
--   * no back-fill (a fresh table; existing months stay unlocked/unfiled)

CREATE TABLE IF NOT EXISTS "tax_filings" (
  "id"          TEXT         NOT NULL,
  "entity_id"   TEXT         NOT NULL,
  "filing_type" TEXT         NOT NULL DEFAULT 'vat',
  "year"        INTEGER      NOT NULL,
  "month"       INTEGER      NOT NULL,
  "status"      TEXT         NOT NULL DEFAULT 'filed',
  "snapshot"    JSONB,
  "notes"       TEXT,
  "filed_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "filed_by"    UUID         NOT NULL,
  "reopened_at" TIMESTAMP(3),
  "reopened_by" UUID,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tax_filings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tax_filings_entity_id_filing_type_year_month_key"
  ON "tax_filings" ("entity_id", "filing_type", "year", "month");

CREATE INDEX IF NOT EXISTS "tax_filings_entity_id_status_idx"
  ON "tax_filings" ("entity_id", "status");
