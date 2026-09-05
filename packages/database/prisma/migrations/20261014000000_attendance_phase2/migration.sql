-- Attendance Phase 2: policy extensions, corrections, shifts, exceptions, permissions.

ALTER TABLE "attendance_policies"
  ADD COLUMN IF NOT EXISTS "half_day_threshold_hours" DECIMAL(4,2) NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS "minimum_working_hours" DECIMAL(4,2) NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS "allowed_work_modes" JSONB NOT NULL DEFAULT '["office","remote","hybrid"]',
  ADD COLUMN IF NOT EXISTS "weekend_days" JSONB NOT NULL DEFAULT '[0,6]',
  ADD COLUMN IF NOT EXISTS "attendance_threshold_pct" INTEGER NOT NULL DEFAULT 80;

CREATE TABLE IF NOT EXISTS "attendance_corrections" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "attendance_record_id" UUID,
    "attendance_date" DATE NOT NULL,
    "correction_type" VARCHAR(40) NOT NULL,
    "reason" TEXT NOT NULL,
    "comments" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "proposed_check_in" TIMESTAMP(3),
    "proposed_check_out" TIMESTAMP(3),
    "proposed_work_mode" VARCHAR(20),
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "reject_remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_corrections_employee_id_idx"
  ON "attendance_corrections"("employee_id");
CREATE INDEX IF NOT EXISTS "attendance_corrections_status_idx"
  ON "attendance_corrections"("status");
CREATE INDEX IF NOT EXISTS "attendance_corrections_attendance_date_idx"
  ON "attendance_corrections"("attendance_date");

CREATE TABLE IF NOT EXISTS "attendance_shifts" (
    "id" UUID NOT NULL,
    "entity_id" TEXT,
    "shift_name" VARCHAR(80) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "grace_minutes" INTEGER NOT NULL DEFAULT 15,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_shifts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_shifts_entity_id_idx"
  ON "attendance_shifts"("entity_id");

CREATE TABLE IF NOT EXISTS "attendance_employee_shifts" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_employee_shifts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_employee_shifts_employee_id_idx"
  ON "attendance_employee_shifts"("employee_id");
CREATE INDEX IF NOT EXISTS "attendance_employee_shifts_employee_id_effective_from_idx"
  ON "attendance_employee_shifts"("employee_id", "effective_from");
CREATE INDEX IF NOT EXISTS "attendance_employee_shifts_shift_id_idx"
  ON "attendance_employee_shifts"("shift_id");

CREATE TABLE IF NOT EXISTS "attendance_exceptions" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'approved',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_exceptions_employee_id_idx"
  ON "attendance_exceptions"("employee_id");
CREATE INDEX IF NOT EXISTS "attendance_exceptions_start_date_end_date_idx"
  ON "attendance_exceptions"("start_date", "end_date");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_corrections_employee_id_fkey') THEN
    ALTER TABLE "attendance_corrections"
      ADD CONSTRAINT "attendance_corrections_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_corrections_attendance_record_id_fkey') THEN
    ALTER TABLE "attendance_corrections"
      ADD CONSTRAINT "attendance_corrections_attendance_record_id_fkey"
      FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_corrections_approved_by_fkey') THEN
    ALTER TABLE "attendance_corrections"
      ADD CONSTRAINT "attendance_corrections_approved_by_fkey"
      FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_shifts_entity_id_fkey') THEN
    ALTER TABLE "attendance_shifts"
      ADD CONSTRAINT "attendance_shifts_entity_id_fkey"
      FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_employee_shifts_employee_id_fkey') THEN
    ALTER TABLE "attendance_employee_shifts"
      ADD CONSTRAINT "attendance_employee_shifts_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_employee_shifts_shift_id_fkey') THEN
    ALTER TABLE "attendance_employee_shifts"
      ADD CONSTRAINT "attendance_employee_shifts_shift_id_fkey"
      FOREIGN KEY ("shift_id") REFERENCES "attendance_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_exceptions_employee_id_fkey') THEN
    ALTER TABLE "attendance_exceptions"
      ADD CONSTRAINT "attendance_exceptions_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_exceptions_approved_by_fkey') THEN
    ALTER TABLE "attendance_exceptions"
      ADD CONSTRAINT "attendance_exceptions_approved_by_fkey"
      FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Default shifts (global, entity_id NULL)
INSERT INTO "attendance_shifts" ("id", "entity_id", "shift_name", "start_time", "end_time", "grace_minutes", "active", "created_at", "updated_at")
SELECT gen_random_uuid(), NULL, 'Morning Shift', '09:00', '18:00', 15, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "attendance_shifts" WHERE "shift_name" = 'Morning Shift' AND "entity_id" IS NULL);

INSERT INTO "attendance_shifts" ("id", "entity_id", "shift_name", "start_time", "end_time", "grace_minutes", "active", "created_at", "updated_at")
SELECT gen_random_uuid(), NULL, 'Evening Shift', '14:00', '23:00', 15, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "attendance_shifts" WHERE "shift_name" = 'Evening Shift' AND "entity_id" IS NULL);

INSERT INTO "attendance_shifts" ("id", "entity_id", "shift_name", "start_time", "end_time", "grace_minutes", "active", "created_at", "updated_at")
SELECT gen_random_uuid(), NULL, 'Night Shift', '22:00', '07:00', 15, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "attendance_shifts" WHERE "shift_name" = 'Night Shift' AND "entity_id" IS NULL);

-- Phase 2 permissions
INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'hrms:attendance-policy-manage'
FROM "roles" r
WHERE ((r.is_system = TRUE AND r.name = 'Admin') OR r.name = 'HR Manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_code = 'hrms:attendance-policy-manage'
  );

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'hrms:attendance-correction-approve'
FROM "roles" r
WHERE ((r.is_system = TRUE AND r.name = 'Admin') OR r.name = 'HR Manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_code = 'hrms:attendance-correction-approve'
  );

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'hrms:attendance-report-export'
FROM "roles" r
WHERE ((r.is_system = TRUE AND r.name = 'Admin') OR r.name = 'HR Manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_code = 'hrms:attendance-report-export'
  );
