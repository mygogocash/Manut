-- Consolidate the Expenses module: remove the dark-shipped v2 tables (never
-- enabled on prod → empty there) and promote the "v1" tables to the canonical
-- expense_* names, preserving all data via ALTER TABLE ... RENAME.
--
-- Prod runs this via `migrate deploy` (data preserved). Staging syncs schema
-- with `db push`, which recreates the tables empty (disposable) — the rename
-- semantics below matter only for prod.
--
-- Idempotent / safe to re-run: the destructive DROP only fires while the v1
-- tables still exist (i.e. BEFORE consolidation). After a successful apply
-- `expenses_v1` is gone, so a re-run skips the DROP entirely and can never
-- drop the live, renamed canonical tables. The table/index/constraint renames
-- below are independently guarded (ALTER ... IF EXISTS / pg_constraint check).

-- 1. Drop the dark-shipped v2 tables (children first for FK order). They hold
--    only a stale pre-split snapshot on prod (never enabled → no unique rows).
--    Guarded on `expenses_v1` still existing so a re-run cannot drop the live
--    canonical `expenses` table after it has been renamed into place.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'expenses_v1'
  ) THEN
    DROP TABLE IF EXISTS "expense_approval_decisions" CASCADE;
    DROP TABLE IF EXISTS "expense_approval_steps" CASCADE;
    DROP TABLE IF EXISTS "expense_reports" CASCADE;
    DROP TABLE IF EXISTS "expenses" CASCADE;
  END IF;
END $$;

-- 2. Rename the v1 tables to the canonical names (data preserved).
ALTER TABLE IF EXISTS "expenses_v1" RENAME TO "expenses";
ALTER TABLE IF EXISTS "expense_reports_v1" RENAME TO "expense_reports";
ALTER TABLE IF EXISTS "expense_approval_steps_v1" RENAME TO "expense_approval_steps";
ALTER TABLE IF EXISTS "expense_approval_decisions_v1" RENAME TO "expense_approval_decisions";

-- 3. Rename indexes to match the canonical table names.
ALTER INDEX IF EXISTS "expenses_v1_employee_id_idx" RENAME TO "expenses_employee_id_idx";
ALTER INDEX IF EXISTS "expenses_v1_status_idx" RENAME TO "expenses_status_idx";
ALTER INDEX IF EXISTS "expenses_v1_travel_request_id_idx" RENAME TO "expenses_travel_request_id_idx";
ALTER INDEX IF EXISTS "expenses_v1_report_id_idx" RENAME TO "expenses_report_id_idx";
ALTER INDEX IF EXISTS "expenses_v1_deleted_at_idx" RENAME TO "expenses_deleted_at_idx";
ALTER INDEX IF EXISTS "expense_reports_v1_employee_id_period_idx" RENAME TO "expense_reports_employee_id_period_idx";
ALTER INDEX IF EXISTS "expense_reports_v1_status_idx" RENAME TO "expense_reports_status_idx";
ALTER INDEX IF EXISTS "expense_reports_v1_deleted_at_idx" RENAME TO "expense_reports_deleted_at_idx";
ALTER INDEX IF EXISTS "expense_approval_steps_v1_order_key" RENAME TO "expense_approval_steps_order_key";
ALTER INDEX IF EXISTS "expense_approval_decisions_v1_approver_user_id_status_idx" RENAME TO "expense_approval_decisions_approver_user_id_status_idx";
ALTER INDEX IF EXISTS "expense_approval_decisions_v1_expense_report_id_idx" RENAME TO "expense_approval_decisions_expense_report_id_idx";
ALTER INDEX IF EXISTS "expense_approval_decisions_v1_expense_report_id_order_key" RENAME TO "expense_approval_decisions_expense_report_id_order_key";

-- 4. Rename PK + FK constraints to match. Guarded so re-runs are safe.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT old_name, new_name FROM (VALUES
    ('expenses_v1_pkey','expenses_pkey'),
    ('expenses_v1_employee_id_fkey','expenses_employee_id_fkey'),
    ('expenses_v1_entity_id_fkey','expenses_entity_id_fkey'),
    ('expenses_v1_category_id_fkey','expenses_category_id_fkey'),
    ('expenses_v1_approved_by_fkey','expenses_approved_by_fkey'),
    ('expenses_v1_travel_request_id_fkey','expenses_travel_request_id_fkey'),
    ('expenses_v1_report_id_fkey','expenses_report_id_fkey'),
    ('expense_reports_v1_pkey','expense_reports_pkey'),
    ('expense_reports_v1_employee_id_fkey','expense_reports_employee_id_fkey'),
    ('expense_reports_v1_entity_id_fkey','expense_reports_entity_id_fkey'),
    ('expense_reports_v1_approved_by_fkey','expense_reports_approved_by_fkey'),
    ('expense_approval_steps_v1_pkey','expense_approval_steps_pkey'),
    ('expense_approval_steps_v1_approver_user_id_fkey','expense_approval_steps_approver_user_id_fkey'),
    ('expense_approval_decisions_v1_pkey','expense_approval_decisions_pkey'),
    ('expense_approval_decisions_v1_expense_report_id_fkey','expense_approval_decisions_expense_report_id_fkey'),
    ('expense_approval_decisions_v1_approver_user_id_fkey','expense_approval_decisions_approver_user_id_fkey'),
    ('expense_approval_decisions_v1_decided_by_id_fkey','expense_approval_decisions_decided_by_id_fkey')
    ) AS m(old_name, new_name)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.old_name) THEN
      EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
        (SELECT conrelid::regclass::text FROM pg_constraint WHERE conname = r.old_name LIMIT 1),
        r.old_name, r.new_name);
    END IF;
  END LOOP;
END $$;
