-- Assets: who the item was bought FROM.
--
-- Distinct from `manufacturer`, which is who made it. A fixed-asset register is
-- audited on the purchase, so the retailer is the field finance and auditors ask
-- about — and mapping a retailer into `manufacturer` would make that column
-- quietly wrong for every hand-bought item.
--
-- Column only, no backfill: nothing existing can be derived into it, and a data
-- migration would run on prod but never on staging (which syncs with db:push).
ALTER TABLE "assets"
  ADD COLUMN IF NOT EXISTS "supplier" TEXT;
