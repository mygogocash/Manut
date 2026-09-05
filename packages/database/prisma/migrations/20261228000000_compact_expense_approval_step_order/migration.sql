-- Heal gaps in expense_approval_steps.order.
--
-- `order` is Int @unique and is rendered directly in the Expense Approval Chain
-- admin page's Order column. Deleting a step never renumbered the survivors, so
-- a chain that had had its second step removed stored 1, 3, 4 and the page
-- displayed exactly that. Sequencing was unaffected — the chain only compares
-- steps relative to each other — so the damage was that the page looked broken
-- and the numbers stopped matching what an admin would type into the Order box.
--
-- The code path is fixed (expenses.repository.ts deleteApprovalStep now
-- compacts inside the delete transaction), but rows already carrying a gap need
-- one pass to catch up. That is this migration.
--
-- Two statements, not one: `order` is UNIQUE and non-deferrable, so an UPDATE
-- that permutes values can trip the constraint on an intermediate row. Park
-- every row above the real range first, then write the final 1..N.
--
-- Idempotent. On an already-compact table the park-and-restore round-trips to
-- the same values, and on an empty table both statements affect zero rows.

-- Phase 1 — park out of the way. +100000 rather than the repository's +10000 so
-- a concurrent reorder parked at 10000+i cannot collide with a parked row here.
UPDATE "expense_approval_steps"
SET "order" = "order" + 100000
WHERE "order" < 100000;

-- Phase 2 — pack into 1..N, preserving the existing relative sequence.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "order" ASC) AS new_order
  FROM "expense_approval_steps"
)
UPDATE "expense_approval_steps" AS s
SET "order" = ranked.new_order
FROM ranked
WHERE s."id" = ranked."id";
