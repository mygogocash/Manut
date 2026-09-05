-- Fixed Asset disposals — point-in-time snapshot of the asset before approval.
-- A partial disposal reduces the live asset's cost + quantity, so re-running an
-- old-dated report recomputed history against today's reduced figures. These
-- columns record what the asset looked like immediately before each approved
-- disposal so reports can reconstruct the state at any past date.
-- Additive + idempotent; all nullable, so rows approved before this shipped
-- simply fall back to the live values (previous behaviour).
ALTER TABLE "fixed_asset_disposals"
  ADD COLUMN IF NOT EXISTS "quantity_before" INTEGER,
  ADD COLUMN IF NOT EXISTS "cost_before" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "opening_book_value_before" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "cost_removed" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "accumulated_removed" DECIMAL(15,2);
