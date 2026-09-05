-- Investor Dashboard — add `sort_order` so the BD team can drag rows
-- to group related family offices / VCs (same affordance the legal
-- + sales grids already ship). New rows land at the default 0;
-- reorder writes assign 1..N in the order the rep dropped them.

ALTER TABLE "investors"
ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "investors_sort_order_idx"
  ON "investors" ("sort_order");
