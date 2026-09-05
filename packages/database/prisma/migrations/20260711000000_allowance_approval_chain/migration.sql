-- IT-15 — Allowance approval chain (Meal, Transportation, Phone).
--
-- Previously, expense reports whose every line item belonged to an
-- `is_allowance = true` category short-circuited to `reimbursed` on
-- submit with a one-row FYI to the finance desk. HR now wants those
-- reports to flow through a 3-stage approval chain instead:
--
--   1. First Approval     — Khun Sarah (single user step)
--   2. Payroll Filled     — payroll team confirms the figure has been
--                           entered into the payroll system
--   3. Final Sign-off     — Kit (single user step) → status flips to
--                           `reimbursed`
--
-- Mechanics:
--   * Three new ExpenseCategory rows (Meal Allowance, Transportation
--     Allowance, Phone Allowance) carry `is_allowance = true`.
--   * `expense_reports.category` becomes `"allowance"` at submit time
--     (service-layer override) when every line item belongs to one of
--     those allowance categories.
--   * Three new ExpenseApprovalStep rows route the chain via
--     `category_filter = ["allowance"]`. `approver_user_id` is left
--     NULL so HR wires Sarah and Kit through the admin UI without
--     another migration.
--   * The existing default Direct-Manager / Skip-Level-Manager steps
--     have their `category_filter` narrowed to the pre-existing
--     report categories (`general`, `business_or_bd`) so they don't
--     trip on allowance reports. Only the seeded defaults with an
--     empty filter are touched — custom HR-configured chains are
--     left alone.
--
-- Fully idempotent: every INSERT / UPDATE is guarded by a NOT EXISTS
-- or value check so partial-apply re-runs are no-ops.

-- ─── 1. Allowance expense categories ──────────────────────────────
INSERT INTO "expense_categories" ("id", "name", "description", "is_active", "is_allowance")
SELECT gen_random_uuid()::text, c.name, c.descr, TRUE, TRUE
FROM (VALUES
  ('Meal Allowance',           'Monthly meal allowance — routed through the allowance approval chain.'),
  ('Transportation Allowance', 'Monthly transportation allowance — routed through the allowance approval chain.'),
  ('Phone Allowance',          'Monthly phone bill allowance — routed through the allowance approval chain.')
) AS c(name, descr)
ON CONFLICT ("name") DO UPDATE
  SET "is_allowance" = TRUE,
      "is_active"    = TRUE;

-- ─── 2. Narrow default Direct-Manager / Skip-Level-Manager steps ──
-- Only touch rows that look exactly like the seeded defaults from
-- 20260710000000_default_l2_approval_steps AND still carry the
-- as-shipped empty filter. Custom chains stay untouched.
UPDATE "expense_approval_steps"
SET "category_filter" = '["general", "business_or_bd"]'::jsonb
WHERE "order" = 1
  AND "approver_type" = 'manager'
  AND "name" = 'Direct Manager'
  AND "category_filter" = '[]'::jsonb;

UPDATE "expense_approval_steps"
SET "category_filter" = '["general", "business_or_bd"]'::jsonb
WHERE "order" = 2
  AND "approver_type" = 'manager_l2'
  AND "name" = 'Skip-Level Manager'
  AND "category_filter" = '[]'::jsonb;

-- ─── 3. Allowance approval chain ─────────────────────────────────
-- Orders 100/101/102 leave space between the default manager chain
-- (1, 2) and any HR-added custom steps. Approver IDs stay NULL —
-- Sarah and Kit are wired in via /expenses/approval-steps after this
-- migration lands. While NULL the steps remain `is_active = true` so
-- the snapshot picks them up; the service then routes to whichever
-- user holds `expense:approve` / `expense:hr-approve` permission.
INSERT INTO "expense_approval_steps"
  ("order", "name", "description", "approver_type", "approver_user_id",
   "category_filter", "is_active")
SELECT 100,
       'Allowance — First Approval (Sarah)',
       'First approval gate for monthly allowance reports (Meal, Transportation, Phone). Assigned to Khun Sarah.',
       'user',
       NULL,
       '["allowance"]'::jsonb,
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM "expense_approval_steps" WHERE "order" = 100);

INSERT INTO "expense_approval_steps"
  ("order", "name", "description", "approver_type", "approver_user_id",
   "category_filter", "is_active")
SELECT 101,
       'Allowance — Payroll Filled',
       'Payroll team approves after the allowance figure has been entered into the payroll system. Triggers the final sign-off stage.',
       'user',
       NULL,
       '["allowance"]'::jsonb,
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM "expense_approval_steps" WHERE "order" = 101);

INSERT INTO "expense_approval_steps"
  ("order", "name", "description", "approver_type", "approver_user_id",
   "category_filter", "is_active")
SELECT 102,
       'Allowance — Final Sign-off (Kit)',
       'Final sign-off after payroll transfer is complete. Closes the allowance report (status → reimbursed). Assigned to Kit.',
       'user',
       NULL,
       '["allowance"]'::jsonb,
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM "expense_approval_steps" WHERE "order" = 102);
