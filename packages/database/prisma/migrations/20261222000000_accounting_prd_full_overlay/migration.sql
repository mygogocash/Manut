-- PRD overlay (schema-only). Staging applies via db:push.

CREATE TABLE IF NOT EXISTS "accounting_fx_rates" (
  "id" TEXT NOT NULL,
  "currency" VARCHAR(10) NOT NULL,
  "effective_date" DATE NOT NULL,
  "buying_rate" DECIMAL(18,8) NOT NULL,
  "selling_rate" DECIMAL(18,8) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'bot',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounting_fx_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_fx_rates_currency_effective_date_key"
  ON "accounting_fx_rates" ("currency", "effective_date");

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "draft_no" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "header_discount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "rounding_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "vendor_tax_invoice_no" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tax_invoice_received" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "fx_side" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "fx_rate_date" DATE;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);

ALTER TABLE "invoice_line_items" ADD COLUMN IF NOT EXISTS "line_discount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "invoice_line_items" ADD COLUMN IF NOT EXISTS "line_vat_rate" DECIMAL(5,2);
ALTER TABLE "invoice_line_items" ADD COLUMN IF NOT EXISTS "vat_reason" TEXT;
ALTER TABLE "invoice_line_items" ADD COLUMN IF NOT EXISTS "tax_base" DECIMAL(15,2);
ALTER TABLE "invoice_line_items" ADD COLUMN IF NOT EXISTS "vat_amount" DECIMAL(15,2);
ALTER TABLE "invoice_line_items" ADD COLUMN IF NOT EXISTS "capitalised" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "receipt_no" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "bank_fee" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "vat_recognised" DECIMAL(15,2) NOT NULL DEFAULT 0;

ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "merged_into_id" UUID;

CREATE INDEX IF NOT EXISTS "invoices_entity_id_vendor_id_vendor_tax_invoice_no_idx"
  ON "invoices" ("entity_id", "vendor_id", "vendor_tax_invoice_no");

CREATE UNIQUE INDEX IF NOT EXISTS "payments_entity_id_receipt_no_key"
  ON "payments" ("entity_id", "receipt_no");
