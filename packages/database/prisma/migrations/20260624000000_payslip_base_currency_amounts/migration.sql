-- Adds entity-currency-equivalent gross / net snapshots to the Payslip table.
-- The bulk importer fills these from HR's "Total Payout {entityCurrency}"
-- column so the run headline doesn't have to fall back to ExchangeRate when
-- the spreadsheet already encodes the per-row FX equivalent. Idempotent so
-- partial re-applies stay safe.
ALTER TABLE "payslips"
    ADD COLUMN IF NOT EXISTS "gross_pay_base" DECIMAL(15, 2),
    ADD COLUMN IF NOT EXISTS "net_pay_base"   DECIMAL(15, 2);
