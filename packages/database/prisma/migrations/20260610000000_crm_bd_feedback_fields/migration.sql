-- Sales CRM v2 — BD-feedback fields:
--   * crm_accounts.region        — coarse geo rollup above country
--   * crm_accounts.total_users   — total registered users at partner
--   * crm_accounts.app_users     — of those, how many on the app / active
--   * crm_opportunities.launch_date — separate "deal closed" from "launched"
--
-- All four columns are nullable, so the migration is safe to run against
-- existing data with no backfill required. `IF NOT EXISTS` keeps the
-- statement idempotent in case a partial run already added some columns.

ALTER TABLE "crm_accounts" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "crm_accounts" ADD COLUMN IF NOT EXISTS "total_users" INTEGER;
ALTER TABLE "crm_accounts" ADD COLUMN IF NOT EXISTS "app_users" INTEGER;

ALTER TABLE "crm_opportunities" ADD COLUMN IF NOT EXISTS "launch_date" DATE;
