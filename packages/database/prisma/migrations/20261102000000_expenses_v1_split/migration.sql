-- Expenses [v1] split — create the legacy parallel tables and COPY all
-- existing report data into them. The original expense_* tables are preserved
-- for the current production Expenses module and the new v2 workflow. Category
-- keys are un-mapped back to the pre-#848 4-category scheme for v1.
-- ExpenseCategory (line-item lookup) is SHARED, not duplicated.
--
-- Guarded so it only snapshots when the v1 tables are empty (re-run safe).
-- This migration must not delete or rewrite production expense rows.
-- Reverse (manual): DROP the _v1 tables.
--
-- NOTE: staging uses `db:push`, so the tables are created there but THIS data
-- copy never runs on staging — v2 keeps its data on staging, v1 stays empty.

-- CreateTable
CREATE TABLE "expenses_v1" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "entity_id" TEXT NOT NULL,
    "category_id" TEXT,
    "travel_request_id" UUID,
    "report_id" UUID,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "receipt_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "reimbursed_at" TIMESTAMP(3),
    "notes" TEXT,
    "je_ref" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_v1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_reports_v1" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "entity_id" TEXT NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "current_step_order" INTEGER,
    "submitted_at" TIMESTAMP(3),
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "approved_total" DECIMAL(15,2),
    "reject_reason" TEXT,
    "reimbursed_at" TIMESTAMP(3),
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_reports_v1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_approval_steps_v1" (
    "id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "approver_type" TEXT NOT NULL DEFAULT 'manager',
    "approver_user_id" UUID,
    "skip_when_submitter_ids" JSONB NOT NULL DEFAULT '[]',
    "only_when_submitter_ids" JSONB NOT NULL DEFAULT '[]',
    "category_filter" JSONB NOT NULL DEFAULT '[]',
    "amount_min_baht" DECIMAL(15,2),
    "amount_max_baht" DECIMAL(15,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_approval_steps_v1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_approval_decisions_v1" (
    "id" UUID NOT NULL,
    "expense_report_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "approver_type" TEXT NOT NULL,
    "approver_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "approved_amount" DECIMAL(15,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_approval_decisions_v1_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_v1_employee_id_idx" ON "expenses_v1"("employee_id");

-- CreateIndex
CREATE INDEX "expenses_v1_status_idx" ON "expenses_v1"("status");

-- CreateIndex
CREATE INDEX "expenses_v1_travel_request_id_idx" ON "expenses_v1"("travel_request_id");

-- CreateIndex
CREATE INDEX "expenses_v1_report_id_idx" ON "expenses_v1"("report_id");

-- CreateIndex
CREATE INDEX "expenses_v1_deleted_at_idx" ON "expenses_v1"("deleted_at");

-- CreateIndex
CREATE INDEX "expense_reports_v1_employee_id_period_idx" ON "expense_reports_v1"("employee_id", "period");

-- CreateIndex
CREATE INDEX "expense_reports_v1_status_idx" ON "expense_reports_v1"("status");

-- CreateIndex
CREATE INDEX "expense_reports_v1_deleted_at_idx" ON "expense_reports_v1"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "expense_approval_steps_v1_order_key" ON "expense_approval_steps_v1"("order");

-- CreateIndex
CREATE INDEX "expense_approval_decisions_v1_approver_user_id_status_idx" ON "expense_approval_decisions_v1"("approver_user_id", "status");

-- CreateIndex
CREATE INDEX "expense_approval_decisions_v1_expense_report_id_idx" ON "expense_approval_decisions_v1"("expense_report_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_approval_decisions_v1_expense_report_id_order_key" ON "expense_approval_decisions_v1"("expense_report_id", "order");

-- AddForeignKey
ALTER TABLE "expenses_v1" ADD CONSTRAINT "expenses_v1_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses_v1" ADD CONSTRAINT "expenses_v1_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses_v1" ADD CONSTRAINT "expenses_v1_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses_v1" ADD CONSTRAINT "expenses_v1_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses_v1" ADD CONSTRAINT "expenses_v1_travel_request_id_fkey" FOREIGN KEY ("travel_request_id") REFERENCES "travel_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses_v1" ADD CONSTRAINT "expenses_v1_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "expense_reports_v1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_reports_v1" ADD CONSTRAINT "expense_reports_v1_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_reports_v1" ADD CONSTRAINT "expense_reports_v1_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_reports_v1" ADD CONSTRAINT "expense_reports_v1_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_approval_steps_v1" ADD CONSTRAINT "expense_approval_steps_v1_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_approval_decisions_v1" ADD CONSTRAINT "expense_approval_decisions_v1_expense_report_id_fkey" FOREIGN KEY ("expense_report_id") REFERENCES "expense_reports_v1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_approval_decisions_v1" ADD CONSTRAINT "expense_approval_decisions_v1_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_approval_decisions_v1" ADD CONSTRAINT "expense_approval_decisions_v1_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Data snapshot (guarded, transactional) ──────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "expense_reports_v1") THEN
    -- 1. Reports first (parent) — un-map category to the old 4-key scheme.
    INSERT INTO "expense_reports_v1" (
      "id","employee_id","entity_id","period","title","category","status",
      "current_step_order","submitted_at","approved_by","approved_at",
      "approved_total","reject_reason","reimbursed_at","notes","deleted_at",
      "created_at","updated_at")
    SELECT
      "id","employee_id","entity_id","period","title",
      CASE
        WHEN "category" = 'business_trip_expense'      THEN 'business_or_bd'
        WHEN "category" = 'monthly_payroll_allowances' THEN 'allowance'
        WHEN "is_office_filed" IS TRUE                 THEN 'office'
        ELSE 'general'
      END,
      "status","current_step_order","submitted_at","approved_by","approved_at",
      "approved_total","reject_reason","reimbursed_at","notes","deleted_at",
      "created_at","updated_at"
    FROM "expense_reports";

    -- 2. Expense lines (drop v2-only sub_type). Preserves report_id (same uuids).
    INSERT INTO "expenses_v1" (
      "id","employee_id","entity_id","category_id","travel_request_id",
      "report_id","description","amount","currency","date","receipt_url",
      "status","approved_by","approved_at","reject_reason","reimbursed_at",
      "notes","je_ref","deleted_at","created_at","updated_at")
    SELECT
      "id","employee_id","entity_id","category_id","travel_request_id",
      "report_id","description","amount","currency","date","receipt_url",
      "status","approved_by","approved_at","reject_reason","reimbursed_at",
      "notes","je_ref","deleted_at","created_at","updated_at"
    FROM "expenses";

    -- 3. Approval-decision snapshots (unchanged shape).
    INSERT INTO "expense_approval_decisions_v1" (
      "id","expense_report_id","order","name","approver_type","approver_user_id",
      "status","decided_by_id","decided_at","approved_amount","notes","created_at")
    SELECT
      "id","expense_report_id","order","name","approver_type","approver_user_id",
      "status","decided_by_id","decided_at","approved_amount","notes","created_at"
    FROM "expense_approval_decisions";

  END IF;

  -- 5. Approval-step CONFIG is COPIED (both v1 and v2 keep their own chain).
  --    Un-map category_filter tokens back to old keys; office_admin_expense
  --    expands to both 'general' and 'office' so v1 steps still match.
  IF NOT EXISTS (SELECT 1 FROM "expense_approval_steps_v1") THEN
    INSERT INTO "expense_approval_steps_v1" (
      "id","order","name","description","approver_type","approver_user_id",
      "skip_when_submitter_ids","only_when_submitter_ids","category_filter",
      "amount_min_baht","amount_max_baht","is_active","created_at","updated_at")
    SELECT
      "id","order","name","description","approver_type","approver_user_id",
      "skip_when_submitter_ids","only_when_submitter_ids",
      REPLACE(REPLACE(REPLACE(
        "category_filter"::text,
        '"business_trip_expense"',      '"business_or_bd"'),
        '"monthly_payroll_allowances"', '"allowance"'),
        '"office_admin_expense"',       '"general","office"')::jsonb,
      "amount_min_baht","amount_max_baht","is_active","created_at","updated_at"
    FROM "expense_approval_steps";
  END IF;
END $$;
