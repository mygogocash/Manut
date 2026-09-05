-- Fundraising pipeline statuses for Investor Dashboard (May 2026).
-- Replaces legacy prospect/active/inactive with seven pipeline stages.
-- Idempotent: safe to re-run; only updates rows still on legacy values.

UPDATE "investors"
SET "status" = 'lead'
WHERE "status" IN ('new', 'prospect', 'declined');

UPDATE "investors"
SET "status" = 'relationship_management'
WHERE "status" IN ('active', 'inactive');

-- Default for new investors going forward.
ALTER TABLE "investors" ALTER COLUMN "status" SET DEFAULT 'lead';
