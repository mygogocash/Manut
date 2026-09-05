-- Investor pipeline columns — 2026-05-28 BD round split the
-- single `est_commission` field into two: actual investment so far
-- (`act_investment`) and estimated future investment (`est_investment`).
-- Both stay TEXT because the xlsx ships "TBD" / "—" / amount strings
-- interchangeably. Data already in `est_commission` migrates over to
-- `est_investment` to preserve any historical entries; the old column
-- is dropped after the copy.

ALTER TABLE "investors"
ADD COLUMN IF NOT EXISTS "act_investment" TEXT,
ADD COLUMN IF NOT EXISTS "est_investment" TEXT;

UPDATE "investors"
SET "est_investment" = "est_commission"
WHERE "est_commission" IS NOT NULL AND "est_investment" IS NULL;

ALTER TABLE "investors" DROP COLUMN IF EXISTS "est_commission";
