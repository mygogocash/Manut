-- Optional extra named tax (e.g. GST) on invoices: a free-text label + a
-- percentage rate that ADDS to the total (alongside VAT), shown below VAT on
-- the document. Additive + idempotent. Rate defaults to 0 = no custom tax.
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tax_label" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0;
