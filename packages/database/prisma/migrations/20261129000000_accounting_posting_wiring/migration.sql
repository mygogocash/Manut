-- M4 — posting-wiring columns.
--
-- Additive + idempotent. Adds the columns the cash-integrity primitive
-- (postMoneyEvent / applyBankMovement) and the payment path need:
--   * invoice_line_items.gl_account_id — optional per-line GL routing.
--   * bank_transactions.source         — provenance of a bank row.
--   * bank_transactions.payment_id     — back-link to the Payment that created
--                                        it (FK, ON DELETE SET NULL).
--
-- No existing value is rewritten: every column is nullable and left NULL on
-- existing rows. currentBalance is NOT recomputed here — the primitive owns it
-- going forward (see the plan's live-figure-mutation rule).

ALTER TABLE "invoice_line_items" ADD COLUMN IF NOT EXISTS "gl_account_id" TEXT;

ALTER TABLE "bank_transactions" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "bank_transactions" ADD COLUMN IF NOT EXISTS "payment_id" TEXT;

CREATE INDEX IF NOT EXISTS "bank_transactions_payment_id_idx"
  ON "bank_transactions" ("payment_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_transactions_payment_id_fkey'
  ) THEN
    ALTER TABLE "bank_transactions"
      ADD CONSTRAINT "bank_transactions_payment_id_fkey"
      FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
