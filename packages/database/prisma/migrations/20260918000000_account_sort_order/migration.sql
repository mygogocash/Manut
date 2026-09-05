-- Sales CRM — add `sort_order` on accounts so reps can drag rows in
-- the Accounts grid (#698 follow-up). Mirrors `legal_projects.sort_order`
-- (Phase 4 Legal CRM, #697). New rows land at the default 0; reorder
-- writes assign 1..N in the order the rep dropped them. Combined with
-- a tie-break on `created_at desc` in the repo, fresh inserts still
-- surface to the top of the default view.

ALTER TABLE "crm_accounts"
ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "crm_accounts_sort_order_idx"
  ON "crm_accounts" ("sort_order");
