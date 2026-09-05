-- Overpayments and prepayments: separate the two things `customer_advances` was
-- conflating, and carry the tax the PRD requires.
--
-- The table held BOTH customer receipts and supplier payments, distinguished
-- only by the literal string 'vendor-advance' in the free-text `notes` column.
-- It also had no way to say WHY the money is here, which is the tax-critical
-- distinction (PRD 9.3 / 9.4):
--
--   'advance'    money for goods or services still to come. Output/input VAT is
--                due at receipt, so the VAT must be carried on the row and
--                relieved when the advance is applied — otherwise the later
--                invoice taxes the same base twice.
--   'refundable' money received or paid in error. No sale, so no VAT.
--
-- The two also behave differently at month end: an advance is NON-monetary
-- under TAS 21 (the obligation is to deliver services) and is not retranslated;
-- a refundable overpayment is monetary and is.
--
-- Idempotent throughout, and the backfills are constrained so re-running cannot
-- reclassify a row a second time.

ALTER TABLE "customer_advances"
  ADD COLUMN IF NOT EXISTS "side" TEXT NOT NULL DEFAULT 'ar';
ALTER TABLE "customer_advances"
  ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'refundable';
ALTER TABLE "customer_advances"
  ADD COLUMN IF NOT EXISTS "vendor_id" UUID;
ALTER TABLE "customer_advances"
  ADD COLUMN IF NOT EXISTS "vat_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "customer_advances"
  ADD COLUMN IF NOT EXISTS "tax_invoice_no" TEXT;
ALTER TABLE "customer_advances"
  ADD COLUMN IF NOT EXISTS "refunded_at" TIMESTAMP(3);
ALTER TABLE "customer_advances"
  ADD COLUMN IF NOT EXISTS "refund_je_id" TEXT;

-- Retire the notes sentinel. Only rows still carrying it are touched, so a
-- second run finds nothing to do.
UPDATE "customer_advances"
SET "side" = 'ap'
WHERE "notes" = 'vendor-advance' AND "side" <> 'ap';

-- Every pre-existing row was booked at its full amount with no VAT split, which
-- is exactly the 'refundable' treatment. That is the DEFAULT, so this is a
-- statement of intent rather than a change: do NOT reclassify history as
-- 'advance', because that would assert a tax point that was never declared.

-- Recover the contact link where the free-text name matches exactly one active
-- contact in the same entity. Ambiguous or unmatched names are deliberately
-- left null rather than guessed — a wrong link would move money to the wrong
-- party on the next contact merge. `WHERE vendor_id IS NULL` makes it re-runnable.
UPDATE "customer_advances" ca
SET "vendor_id" = v.id
FROM "vendors" v
WHERE ca."vendor_id" IS NULL
  AND v."entity_id" = ca."entity_id"
  AND v."deleted_at" IS NULL
  AND lower(btrim(v."name")) = lower(btrim(ca."counterparty"))
  AND (
    SELECT count(*) FROM "vendors" v2
    WHERE v2."entity_id" = ca."entity_id"
      AND v2."deleted_at" IS NULL
      AND lower(btrim(v2."name")) = lower(btrim(ca."counterparty"))
  ) = 1;

CREATE INDEX IF NOT EXISTS "customer_advances_entity_side_status_idx"
  ON "customer_advances"("entity_id", "side", "status");
CREATE INDEX IF NOT EXISTS "customer_advances_vendor_id_idx"
  ON "customer_advances"("vendor_id");
