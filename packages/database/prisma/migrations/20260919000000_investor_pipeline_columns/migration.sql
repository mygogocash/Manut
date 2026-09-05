-- Investor Dashboard — align the `investors` table with the columns
-- the BD team already works in via "TBH Pipeline Master.xlsx": title /
-- linkedinUrl / revenueStream / lastContactDate / nextAction /
-- estCommission / crossSell / region / notesText. Every field is
-- nullable so existing rows stay valid. `notes_text` carries the
-- long-form pipeline note; the legacy `notes` JSON column stays
-- alongside for any structured callers still relying on it.

ALTER TABLE "investors"
ADD COLUMN IF NOT EXISTS "title" TEXT,
ADD COLUMN IF NOT EXISTS "linkedin_url" TEXT,
ADD COLUMN IF NOT EXISTS "revenue_stream" TEXT,
ADD COLUMN IF NOT EXISTS "last_contact_date" DATE,
ADD COLUMN IF NOT EXISTS "next_action" TEXT,
ADD COLUMN IF NOT EXISTS "est_commission" TEXT,
ADD COLUMN IF NOT EXISTS "cross_sell" TEXT,
ADD COLUMN IF NOT EXISTS "region" TEXT,
ADD COLUMN IF NOT EXISTS "notes_text" TEXT;
