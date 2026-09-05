-- Add description column to leave_types so admins can document policies.
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "description" TEXT;
