-- Attendance Phase 3: timezone fields, automation config, additive only

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS employee_timezone VARCHAR(64),
  ADD COLUMN IF NOT EXISTS check_in_utc TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS check_out_utc TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS local_check_in_time VARCHAR(40),
  ADD COLUMN IF NOT EXISTS local_check_out_time VARCHAR(40);

ALTER TABLE attendance_policies
  ADD COLUMN IF NOT EXISTS default_timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Bangkok',
  ADD COLUMN IF NOT EXISTS missed_check_in_after_minutes INT NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS missed_check_out_after_minutes INT NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS consecutive_absence_alert_days INT NOT NULL DEFAULT 3;

-- Backfill UTC mirrors from existing check-in/out
UPDATE attendance_records
SET
  check_in_utc = check_in,
  check_out_utc = check_out
WHERE check_in_utc IS NULL AND check_in IS NOT NULL;
