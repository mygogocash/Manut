-- Fixed Asset GL account routing (Phase 2 foundations).
--
-- Depreciation needs TWO accounts — the expense and the accumulated-depreciation
-- contra — but the table carried only one `depreciation_gl_account_id`, so the
-- entry could not be expressed. Disposals additionally need gain and loss
-- accounts (kept separate: Thai RD treats a write-off loss differently from a
-- disposal gain, and a single signed account cannot be split later).
--
-- All nullable with no backfill: null means "fall back to the entity-level
-- AccountMapping role", which is the intended default for entities that route
-- every category to one set of accounts.
--
-- Idempotent so a partial apply can be re-run.

ALTER TABLE "fixed_asset_categories"
  ADD COLUMN IF NOT EXISTS "accumulated_depreciation_gl_account_id" TEXT,
  ADD COLUMN IF NOT EXISTS "disposal_gain_gl_account_id" TEXT,
  ADD COLUMN IF NOT EXISTS "disposal_loss_gl_account_id" TEXT;
