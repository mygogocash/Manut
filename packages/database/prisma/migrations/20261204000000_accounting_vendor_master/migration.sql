-- Chunk 4 — Customer/supplier master overhaul (M1)
-- Additive, non-breaking: every column is nullable (or the deletedAt soft-delete
-- marker). `name` is kept and never dropped — it is referenced widely across
-- AR/AP documents. Safe to re-run (IF NOT EXISTS / guarded backfill).

-- Bilingual name (canonical `name` retained; `name_en` backfilled below).
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "name_th" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "name_en" TEXT;

-- Payment terms keyword (cash | net7 | net14 | net30 | net45 | net60 | net90 | eom | custom).
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "payment_terms" TEXT;

-- Accounting defaults.
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "default_currency" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "tax_treatment" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "default_revenue_account_id" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "default_expense_account_id" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "default_wht_rate" DECIMAL(7,4);
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "credit_limit" DECIMAL(18,2);

-- Separate delivery address (distinct from the tax-invoice address in address_th/en).
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "delivery_address_th" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "delivery_address_en" TEXT;

-- Soft delete.
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- Backfill name_en from the existing canonical name for rows that predate the
-- bilingual columns. Guarded so re-runs never clobber a hand-entered name_en.
UPDATE "vendors" SET "name_en" = "name" WHERE "name_en" IS NULL;

-- Soft-delete lookup index.
CREATE INDEX IF NOT EXISTS "vendors_deleted_at_idx" ON "vendors"("deleted_at");
