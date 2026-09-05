-- Per-payslip PDF / document URL (Supabase storage). Powers the
-- /my-portal "My Payslip" tab — employees view + download their own
-- HR-uploaded payslip without needing payroll:read on the run itself.
-- Idempotent ADD COLUMN so partial-apply incidents survive a re-run.
ALTER TABLE "payslips"
  ADD COLUMN IF NOT EXISTS "document_url" TEXT;
