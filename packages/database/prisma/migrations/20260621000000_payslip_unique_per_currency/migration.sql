-- Loosen the payslip uniqueness so the same person can hold one payslip
-- per currency in the same run — HR's import xlsx legitimately lists a
-- contractor across two rows (e.g. THB retainer + USD performance fee).
-- The old (run, employee) unique forced the importer to merge the rows
-- and silently mix currencies, which corrupted the by-currency rollup.
--
-- Re-using the legacy index name keeps Prisma's drift detector happy
-- and avoids a follow-up create-then-drop on the next migrate.
ALTER TABLE "payslips" DROP CONSTRAINT IF EXISTS "payslips_payroll_run_id_employee_id_key";
DROP INDEX IF EXISTS "payslips_payroll_run_id_employee_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "payslips_payroll_run_id_employee_id_currency_key"
  ON "payslips" ("payroll_run_id", "employee_id", "currency");
