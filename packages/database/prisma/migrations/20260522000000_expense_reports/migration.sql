-- ExpenseReport: monthly container that aggregates a set of Expense
-- rows and is approved by the employee's line manager in one go.
--
-- The flow:
--   - employee creates a draft report for a YYYY-MM period
--   - employee adds expenses (Expense.report_id) to it
--   - employee submits → status = "submitted", line manager notified
--   - manager approves / rejects → status updates, employee notified
--   - finance / HR optionally marks it reimbursed
--
-- Existing Expense rows keep `report_id = NULL` so the legacy single-
-- expense flow (one approval per receipt) continues to work for any
-- data that was filed before this migration shipped.

CREATE TABLE IF NOT EXISTS "expense_reports" (
  "id"            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id"   UUID         NOT NULL,
  "entity_id"     TEXT         NOT NULL,
  "period"        VARCHAR(7)   NOT NULL,
  "title"         TEXT         NOT NULL,
  "status"        TEXT         NOT NULL DEFAULT 'draft',
  "submitted_at"  TIMESTAMP(3),
  "approved_by"   UUID,
  "approved_at"   TIMESTAMP(3),
  "reject_reason" TEXT,
  "reimbursed_at" TIMESTAMP(3),
  "notes"         TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "expense_reports_employee_fk"
    FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "expense_reports_entity_fk"
    FOREIGN KEY ("entity_id")   REFERENCES "entities"("id"),
  CONSTRAINT "expense_reports_approver_fk"
    FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "expense_reports_employee_period_idx"
  ON "expense_reports" ("employee_id", "period");

CREATE INDEX IF NOT EXISTS "expense_reports_status_idx"
  ON "expense_reports" ("status");

ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "report_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM   information_schema.table_constraints
      WHERE  table_name = 'expenses'
        AND  constraint_name = 'expenses_report_fk'
  ) THEN
    ALTER TABLE "expenses"
      ADD CONSTRAINT "expenses_report_fk"
      FOREIGN KEY ("report_id") REFERENCES "expense_reports"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "expenses_report_id_idx"
  ON "expenses" ("report_id");
