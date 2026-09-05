-- TM.47 submission receipt stored in private `documents` bucket.
ALTER TABLE "ninety_day_notifications"
  ADD COLUMN IF NOT EXISTS "receipt_url" TEXT,
  ADD COLUMN IF NOT EXISTS "receipt_name" TEXT,
  ADD COLUMN IF NOT EXISTS "receipt_mime_type" TEXT;
