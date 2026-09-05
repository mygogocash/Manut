-- Project-team feedback (2026-06-10): add an "Agreement" column to the
-- Project CRM (Signed / Not Signed), shown after Rev. GoLive. Free-text
-- column constrained by a frontend whitelist; NULL = not set.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "agreement" TEXT;
