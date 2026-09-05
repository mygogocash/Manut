-- Offboarding (exit) checklist module. Mirrors `onboarding_runs` but
-- adds `position`, `last_working_day` (replacing onboarding's
-- `start_date`), and employee/HR signature columns for the printable
-- TBH On/Offboarding checklist.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded constraint adds so
-- a partial-apply incident can be re-run safely.

-- CreateTable
CREATE TABLE IF NOT EXISTS "offboarding_runs" (
    "id" UUID NOT NULL,
    "employee_id" UUID,
    "employee_name" TEXT NOT NULL,
    "position" TEXT,
    "department" TEXT NOT NULL,
    "last_working_day" DATE NOT NULL,
    "tasks" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "employee_sign_name" TEXT,
    "employee_signed_at" TIMESTAMP(3),
    "hr_sign_name" TEXT,
    "hr_signed_at" TIMESTAMP(3),
    "entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offboarding_runs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (Postgres has no ADD CONSTRAINT IF NOT EXISTS — guard via pg_constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'offboarding_runs_employee_id_fkey'
  ) THEN
    ALTER TABLE "offboarding_runs"
      ADD CONSTRAINT "offboarding_runs_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'offboarding_runs_entity_id_fkey'
  ) THEN
    ALTER TABLE "offboarding_runs"
      ADD CONSTRAINT "offboarding_runs_entity_id_fkey"
      FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed the new permission onto the system Admin role and HR Manager so
-- the Offboarding tab is usable out of the box. Other roles get it via
-- the Roles UI. Idempotent: NOT EXISTS guard for partial-apply re-runs.
INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'hrms:offboarding-manage'
FROM "roles" r
WHERE ((r.is_system = TRUE AND r.name = 'Admin') OR r.name = 'HR Manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id
      AND rp.permission_code = 'hrms:offboarding-manage'
  );
