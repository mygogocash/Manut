-- M3/M6 — Settlement allocations: let ONE payment clear MANY invoices.
--
-- Today Payment→Invoice is 1:1 (payments.invoice_id). This adds an allocation
-- join table so a single receipt/disbursement can be split across several
-- documents. The legacy 1:1 link stays as the "primary" invoice and every
-- existing payment is back-filled into a single allocation, so nothing changes
-- behaviourally — the multi-invoice WRITE path is gated behind
-- ACCOUNTING_SETTLEMENT_V2 and lands in a follow-up.
--
-- ADDITIVE + IDEMPOTENT (safe to re-run after a P3009 partial apply):
--   * CREATE TABLE / INDEX ... IF NOT EXISTS
--   * FKs added inside guarded DO-blocks (skip if already present)
--   * back-fill only inserts payments that have no allocation yet
--
-- NOTE: the back-fill runs on prod (prisma migrate deploy) but NOT on staging
-- (staging syncs schema via `db:push`, which never runs migration SQL). That is
-- fine — the allocation model is not read by any live path yet; the follow-up
-- write path seeds it going forward.

CREATE TABLE IF NOT EXISTS "payment_allocations" (
  "id"         UUID           NOT NULL DEFAULT gen_random_uuid(),
  "payment_id" TEXT           NOT NULL,
  "invoice_id" TEXT           NOT NULL,
  "amount"     DECIMAL(15, 2) NOT NULL,
  "wht_amount" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "base_amount" DECIMAL(15, 2),
  "created_at" TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_allocations_payment_id_idx"
  ON "payment_allocations" ("payment_id");
CREATE INDEX IF NOT EXISTS "payment_allocations_invoice_id_idx"
  ON "payment_allocations" ("invoice_id");

DO $$ BEGIN
  ALTER TABLE "payment_allocations"
    ADD CONSTRAINT "payment_allocations_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "payment_allocations"
    ADD CONSTRAINT "payment_allocations_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Back-fill: one allocation per existing (non-deleted) payment. Idempotent —
-- skips any payment that already has an allocation row.
INSERT INTO "payment_allocations"
  ("payment_id", "invoice_id", "amount", "wht_amount", "base_amount", "created_at")
SELECT p."id", p."invoice_id", p."amount", p."wht_amount", p."base_amount", p."created_at"
FROM "payments" p
WHERE p."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "payment_allocations" a WHERE a."payment_id" = p."id"
  );
