-- Fixed Asset: posting handle + tax basis (Phase 2 foundations).
--
-- Landed as ONE migration because the table is already populated on staging —
-- a second ALTER pass over live rows is worth avoiding, and the tax columns are
-- known to be needed even though the deferred tax schedule ships later.
--
-- linked_je_id is the disposal's posted journal entry AND its idempotency
-- handle: a disposal that already carries one is never posted twice.
--
-- The tax columns are the tax-basis mirror of the book basis. They are
-- deliberately nullable with NO backfill and NO default: a fallback to the book
-- life would compute a temporary difference of exactly zero and render a clean,
-- plausible, entirely wrong deferred tax schedule. Null means "unknown", and
-- the schedule must exclude the asset and say so.
--
-- accumulated_tax_removed / opening_tax_wdv_before are the tax counterparts of
-- the existing before-snapshot columns. Without them a partial disposal
-- restates tax history the same way it once restated book history (PR #1014).
--
-- Idempotent so a partial apply can be re-run.

ALTER TABLE "fixed_asset_disposals"
  ADD COLUMN IF NOT EXISTS "linked_je_id" TEXT,
  ADD COLUMN IF NOT EXISTS "accumulated_tax_removed" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "opening_tax_wdv_before" DECIMAL(15,2);

ALTER TABLE "fixed_assets"
  ADD COLUMN IF NOT EXISTS "tax_useful_life_months" INTEGER,
  ADD COLUMN IF NOT EXISTS "opening_tax_wdv" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "opening_tax_as_of_date" DATE;

ALTER TABLE "fixed_asset_categories"
  ADD COLUMN IF NOT EXISTS "tax_useful_life_months" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fixed_asset_disposals_linked_je_id_fkey'
  ) THEN
    ALTER TABLE "fixed_asset_disposals"
      ADD CONSTRAINT "fixed_asset_disposals_linked_je_id_fkey"
      FOREIGN KEY ("linked_je_id") REFERENCES "journal_entries"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
