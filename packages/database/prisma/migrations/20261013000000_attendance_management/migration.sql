-- Attendance management: policies, daily records, audit trail.
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded constraint adds.

CREATE TABLE IF NOT EXISTS "attendance_policies" (
    "id" UUID NOT NULL,
    "entity_id" TEXT,
    "shift_start_time" VARCHAR(5) NOT NULL DEFAULT '09:00',
    "shift_end_time" VARCHAR(5) NOT NULL DEFAULT '18:00',
    "grace_minutes" INTEGER NOT NULL DEFAULT 15,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_policies_entity_id_key"
  ON "attendance_policies"("entity_id");

CREATE TABLE IF NOT EXISTS "attendance_records" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "attendance_date" DATE NOT NULL,
    "check_in" TIMESTAMP(3),
    "check_out" TIMESTAMP(3),
    "work_mode" VARCHAR(20) NOT NULL DEFAULT 'office',
    "status" VARCHAR(20) NOT NULL DEFAULT 'absent',
    "total_hours" DECIMAL(5,2),
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_records_employee_id_attendance_date_key"
  ON "attendance_records"("employee_id", "attendance_date");

CREATE INDEX IF NOT EXISTS "attendance_records_attendance_date_idx"
  ON "attendance_records"("attendance_date");

CREATE INDEX IF NOT EXISTS "attendance_records_status_idx"
  ON "attendance_records"("status");

CREATE TABLE IF NOT EXISTS "attendance_audit_logs" (
    "id" UUID NOT NULL,
    "record_id" UUID,
    "employee_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "actor_id" UUID,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_audit_logs_employee_id_idx"
  ON "attendance_audit_logs"("employee_id");

CREATE INDEX IF NOT EXISTS "attendance_audit_logs_record_id_idx"
  ON "attendance_audit_logs"("record_id");

CREATE INDEX IF NOT EXISTS "attendance_audit_logs_created_at_idx"
  ON "attendance_audit_logs"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_policies_entity_id_fkey'
  ) THEN
    ALTER TABLE "attendance_policies"
      ADD CONSTRAINT "attendance_policies_entity_id_fkey"
      FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_employee_id_fkey'
  ) THEN
    ALTER TABLE "attendance_records"
      ADD CONSTRAINT "attendance_records_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_audit_logs_record_id_fkey'
  ) THEN
    ALTER TABLE "attendance_audit_logs"
      ADD CONSTRAINT "attendance_audit_logs_record_id_fkey"
      FOREIGN KEY ("record_id") REFERENCES "attendance_records"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_audit_logs_employee_id_fkey'
  ) THEN
    ALTER TABLE "attendance_audit_logs"
      ADD CONSTRAINT "attendance_audit_logs_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_audit_logs_actor_id_fkey'
  ) THEN
    ALTER TABLE "attendance_audit_logs"
      ADD CONSTRAINT "attendance_audit_logs_actor_id_fkey"
      FOREIGN KEY ("actor_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Global default shift policy (entity_id NULL).
INSERT INTO "attendance_policies" (
  "id",
  "entity_id",
  "shift_start_time",
  "shift_end_time",
  "grace_minutes",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  NULL,
  '09:00',
  '18:00',
  15,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "attendance_policies" WHERE "entity_id" IS NULL
);

-- Seed attendance permissions onto Admin + HR Manager.
INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'hrms:attendance-read'
FROM "roles" r
WHERE ((r.is_system = TRUE AND r.name = 'Admin') OR r.name = 'HR Manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id
      AND rp.permission_code = 'hrms:attendance-read'
  );

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'hrms:attendance-manage'
FROM "roles" r
WHERE ((r.is_system = TRUE AND r.name = 'Admin') OR r.name = 'HR Manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id
      AND rp.permission_code = 'hrms:attendance-manage'
  );
