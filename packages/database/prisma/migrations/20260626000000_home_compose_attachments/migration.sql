-- Adds JSON `attachments` columns to the three home-page surfaces so
-- HR / admin can attach images or PDFs when composing a wall post,
-- company news headline, or company-date entry. Same shape as
-- `HelpdeskTicket.attachments` (array of `{name,url,mimeType,size}`).
-- Idempotent so partial re-applies stay safe.
ALTER TABLE "wall_posts"   ADD COLUMN IF NOT EXISTS "attachments" JSONB;
ALTER TABLE "company_news" ADD COLUMN IF NOT EXISTS "attachments" JSONB;
ALTER TABLE "company_dates" ADD COLUMN IF NOT EXISTS "attachments" JSONB;
