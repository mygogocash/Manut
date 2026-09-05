-- Expense approval chain. Mirrors the travel chain's pattern: an
-- admin-managed list of ordered steps, snapshotted to per-report
-- decisions on submit so editing the chain later doesn't rewrite
-- in-flight reports.

ALTER TABLE "expense_reports"
  ADD COLUMN IF NOT EXISTS "current_step_order" INTEGER;

CREATE TABLE IF NOT EXISTS "expense_approval_steps" (
  "id"                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "order"                    INTEGER      NOT NULL,
  "name"                     VARCHAR(100) NOT NULL,
  "description"              TEXT,
  "approver_type"            TEXT         NOT NULL DEFAULT 'manager',
  "approver_user_id"         UUID,
  "skip_when_submitter_ids"  JSONB        NOT NULL DEFAULT '[]'::jsonb,
  "only_when_submitter_ids"  JSONB        NOT NULL DEFAULT '[]'::jsonb,
  "is_active"                BOOLEAN      NOT NULL DEFAULT TRUE,
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "expense_approval_steps_approver_fk"
    FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "expense_approval_steps_order_uq"
  ON "expense_approval_steps" ("order");

CREATE TABLE IF NOT EXISTS "expense_approval_decisions" (
  "id"                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "expense_report_id"   UUID         NOT NULL,
  "order"               INTEGER      NOT NULL,
  "name"                VARCHAR(100) NOT NULL,
  "approver_type"       TEXT         NOT NULL,
  "approver_user_id"    UUID,
  "status"              TEXT         NOT NULL DEFAULT 'pending',
  "decided_by_id"       UUID,
  "decided_at"          TIMESTAMP(3),
  "notes"               TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "expense_approval_decisions_report_fk"
    FOREIGN KEY ("expense_report_id") REFERENCES "expense_reports"("id") ON DELETE CASCADE,
  CONSTRAINT "expense_approval_decisions_approver_fk"
    FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "expense_approval_decisions_decided_by_fk"
    FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "expense_approval_decisions_report_order_uq"
  ON "expense_approval_decisions" ("expense_report_id", "order");

CREATE INDEX IF NOT EXISTS "expense_approval_decisions_approver_status_idx"
  ON "expense_approval_decisions" ("approver_user_id", "status");

CREATE INDEX IF NOT EXISTS "expense_approval_decisions_report_idx"
  ON "expense_approval_decisions" ("expense_report_id");
