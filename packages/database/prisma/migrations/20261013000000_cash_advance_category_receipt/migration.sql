-- Cash advance line items gain an optional GL category (shared with
-- expenses) and an optional supporting receipt. Idempotent so a
-- partial-apply re-run is safe.

ALTER TABLE "cash_advance_items" ADD COLUMN IF NOT EXISTS "category_id" TEXT;
ALTER TABLE "cash_advance_items" ADD COLUMN IF NOT EXISTS "receipt_url" TEXT;

-- FK to the shared expense category list. SET NULL on delete so removing
-- a category doesn't orphan or block existing advance lines (matches the
-- expenses.category_id behaviour).
DO $$ BEGIN
  ALTER TABLE "cash_advance_items"
    ADD CONSTRAINT "cash_advance_items_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
