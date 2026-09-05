-- Half-day leave: duration type + morning/afternoon period (all leave categories).
ALTER TABLE "leave_requests"
ADD COLUMN IF NOT EXISTS "duration_type" TEXT NOT NULL DEFAULT 'full_day';

ALTER TABLE "leave_requests"
ADD COLUMN IF NOT EXISTS "half_day_period" TEXT;
