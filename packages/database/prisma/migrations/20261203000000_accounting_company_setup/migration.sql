-- Accounting Phase-1 Foundation — Chunk 2: company setup, fiscal year &
-- activation gate. Additive + idempotent + fully non-breaking.
--
-- Every column below is nullable or defaulted, so `ADD COLUMN IF NOT EXISTS`
-- backfills every existing `entities` row without touching data:
--   * setup_state defaults to 'active'  → all pre-existing entities are
--     grandfathered "active" and keep issuing documents uninterrupted. Only
--     entities created through the new company-setup flow start in 'setup'.
--   * fiscal_year_start_month defaults to 1 (January — PRD decision #1).
--   * default_rate_source defaults to 'bot'.
--   * enabled_currencies defaults to the empty text[].
--
-- Safe to re-run (IF NOT EXISTS on every statement).

ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "name_th" TEXT;
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "branch_code" TEXT;
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "vat_registration_status" TEXT;
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "boi_type" TEXT;
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "boi_period" TEXT;
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "fiscal_year_start_month" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "first_fiscal_year_start" TIMESTAMP(3);
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "first_fiscal_year_end" TIMESTAMP(3);
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "default_rate_source" TEXT NOT NULL DEFAULT 'bot';
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "enabled_currencies" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "setup_state" TEXT NOT NULL DEFAULT 'active';
