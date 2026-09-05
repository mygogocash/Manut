-- Thai 90-day notification tracker (TM.47). Stored alongside visa
-- records so HR can drive both expiry workflows from one screen.
-- `due_date` is server-computed (last_arrival_date + 89 days) and
-- materialised here so the cron + list filters stay cheap.
-- Idempotent so a partial-apply re-runs cleanly.

CREATE TABLE IF NOT EXISTS "ninety_day_notifications" (
  "id"                          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "employee_id"                 UUID         NOT NULL,
  "last_arrival_date"           DATE         NOT NULL,
  "due_date"                    DATE         NOT NULL,
  "status"                      TEXT         NOT NULL DEFAULT 'pending',
  "notes"                       TEXT,
  "last_reminder_milestone_days" INTEGER,
  "last_reminder_sent_at"       TIMESTAMP(3),
  "created_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ninety_day_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ninety_day_notifications_employee_id_idx"
  ON "ninety_day_notifications" ("employee_id");

CREATE INDEX IF NOT EXISTS "ninety_day_notifications_due_date_idx"
  ON "ninety_day_notifications" ("due_date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ninety_day_notifications_employee_id_fkey'
      AND table_name = 'ninety_day_notifications'
  ) THEN
    ALTER TABLE "ninety_day_notifications"
      ADD CONSTRAINT "ninety_day_notifications_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
