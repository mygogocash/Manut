-- Add soft delete support across 7 modules: Users, Accounting, Leave, Travel, Expenses, Cash Advance, Visa

-- core.prisma: User, Department, Entity
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users"("deleted_at");

ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;

ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;

-- rbac.prisma: Role, UserGroup
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;

ALTER TABLE "user_groups" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;

-- finance.prisma: ChartOfAccount, JournalEntry, Invoice, Expense, ExpenseReport, CashAdvanceRequest
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;

ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;

ALTER TABLE "expense_reports" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
CREATE INDEX IF NOT EXISTS "expense_reports_deleted_at_idx" ON "expense_reports"("deleted_at");

ALTER TABLE "cash_advance_requests" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
CREATE INDEX IF NOT EXISTS "cash_advance_requests_deleted_at_idx" ON "cash_advance_requests"("deleted_at");

-- hr.prisma: LeaveRequest, TravelRequest, VisaRecord
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
CREATE INDEX IF NOT EXISTS "leave_requests_deleted_at_idx" ON "leave_requests"("deleted_at");

ALTER TABLE "travel_requests" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
CREATE INDEX IF NOT EXISTS "travel_requests_deleted_at_idx" ON "travel_requests"("deleted_at");

ALTER TABLE "visa_records" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
CREATE INDEX IF NOT EXISTS "visa_records_deleted_at_idx" ON "visa_records"("deleted_at");
