-- M8 — Multi-currency GL posting: store the three required values on each
-- money document (source amount + exchange rate + reporting/base amount).
--
-- The GL/journal stays single-currency (the entity's base currency); each
-- document now carries the rate it was booked at so realised FX gain/loss can
-- be computed at settlement (payment rate vs invoice rate).
--
-- ADDITIVE + IDEMPOTENT (safe to re-run after a P3009 partial apply):
--   * new columns via ADD COLUMN IF NOT EXISTS
--   * backfill only touches rows still NULL
--
-- NOTE: the UPDATE backfill runs on prod (prisma migrate deploy) but NOT on
-- staging (staging syncs schema via `db:push`, which never runs migration SQL).
-- That is fine: every pre-existing posted document is THB (GL posting was
-- THB-guarded until now), and the service reads a NULL exchange_rate as 1 and a
-- NULL base_amount as `amount`, so staging behaves identically until seeded.

-- ── invoices: document-date rate + base (reporting) amount ──────────────────
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "exchange_rate" NUMERIC(18, 8) DEFAULT 1;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "base_amount"   NUMERIC(15, 2);

UPDATE "invoices" SET "exchange_rate" = 1        WHERE "exchange_rate" IS NULL;
UPDATE "invoices" SET "base_amount"   = "amount" WHERE "base_amount"   IS NULL;

-- ── payments: currency + settlement-date rate + base (reporting) amount ─────
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "currency"      VARCHAR(10);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "exchange_rate" NUMERIC(18, 8) DEFAULT 1;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "base_amount"   NUMERIC(15, 2);

UPDATE "payments" SET "currency"      = 'THB'    WHERE "currency"      IS NULL;
UPDATE "payments" SET "exchange_rate" = 1        WHERE "exchange_rate" IS NULL;
UPDATE "payments" SET "base_amount"   = "amount" WHERE "base_amount"   IS NULL;
