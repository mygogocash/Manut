-- Optional in-app deep link on dashboard items (survey announcements point
-- at the respond page). Idempotent; matches what db:push synced on staging.
ALTER TABLE "wall_posts" ADD COLUMN IF NOT EXISTS "link_url" TEXT;
ALTER TABLE "company_news" ADD COLUMN IF NOT EXISTS "link_url" TEXT;
ALTER TABLE "company_dates" ADD COLUMN IF NOT EXISTS "link_url" TEXT;
