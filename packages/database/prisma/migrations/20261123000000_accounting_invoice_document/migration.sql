-- Full-document invoices: bill-to / reference / payment-terms / VAT + WHT rates
-- on the invoice header, plus a line-item child table (Description / Qty /
-- Unit Price). Additive + idempotent + reversible. Existing summary rows keep
-- working (new columns nullable / defaulted; amount stays the grand total).

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "bill_to_address" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_terms" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "wht_rate" DECIMAL(5,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "invoice_line_items" (
  "id"          TEXT NOT NULL,
  "invoice_id"  TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity"    DECIMAL(15,2) NOT NULL DEFAULT 1,
  "unit_price"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  "sort_order"  INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "invoice_line_items_invoice_id_idx" ON "invoice_line_items" ("invoice_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_line_items_invoice_id_fkey'
  ) THEN
    ALTER TABLE "invoice_line_items"
      ADD CONSTRAINT "invoice_line_items_invoice_id_fkey"
      FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
