-- Lock / Vesting / Increasing periods on EsopGrant are now nullable
-- so the imported table reflects HR's spreadsheet faithfully — empty
-- xlsx cells render as "—" instead of being silently rewritten with
-- the old PRD §11.4 defaults (lock 0 / vesting 48 / cliff 12).
--
-- Existing imported rows that already carry the legacy default-fill
-- are NOT auto-cleared — there's no way to tell apart "HR typed 4
-- Years (= 48)" from "HR left it blank, importer used default 48".
-- Run `replace=true` against the latest Equity Summary Report after
-- the migration to refresh those rows; manually-created grants stay
-- untouched either way.

ALTER TABLE "esop_grants" ALTER COLUMN "vesting_months" DROP DEFAULT;
ALTER TABLE "esop_grants" ALTER COLUMN "vesting_months" DROP NOT NULL;

ALTER TABLE "esop_grants" ALTER COLUMN "cliff_months" DROP DEFAULT;
ALTER TABLE "esop_grants" ALTER COLUMN "cliff_months" DROP NOT NULL;

ALTER TABLE "esop_grants" ALTER COLUMN "lock_months" DROP DEFAULT;
ALTER TABLE "esop_grants" ALTER COLUMN "lock_months" DROP NOT NULL;
