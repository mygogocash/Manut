-- IT helpdesk ↔ GitHub issues two-way sync (Sid + BD feedback,
-- 2026-05-24). Schema columns only; service + webhook land in the
-- same PR.
--
-- Idempotent: every ADD COLUMN uses IF NOT EXISTS so partial-apply /
-- re-runs are safe.

ALTER TABLE "helpdesk_tickets"
  ADD COLUMN IF NOT EXISTS "github_issue_number" INTEGER,
  ADD COLUMN IF NOT EXISTS "github_issue_url" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "helpdesk_tickets_github_issue_number_key"
  ON "helpdesk_tickets"("github_issue_number");

-- For the NOT NULL columns we run the safer 3-step pattern so a
-- partial earlier apply that created the column nullable doesn't
-- leave us with silent schema drift (Prisma's runtime expects NOT
-- NULL but the DB still allows NULL writes).
ALTER TABLE "helpdesk_settings"
  ADD COLUMN IF NOT EXISTS "github_enabled" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "github_repo_owner" TEXT,
  ADD COLUMN IF NOT EXISTS "github_repo_name" TEXT,
  ADD COLUMN IF NOT EXISTS "github_token_encrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "github_webhook_secret" TEXT,
  ADD COLUMN IF NOT EXISTS "github_label_in_progress" TEXT,
  ADD COLUMN IF NOT EXISTS "github_label_review" TEXT;

UPDATE "helpdesk_settings"
  SET "github_enabled" = FALSE WHERE "github_enabled" IS NULL;
UPDATE "helpdesk_settings"
  SET "github_label_in_progress" = 'in progress' WHERE "github_label_in_progress" IS NULL;
UPDATE "helpdesk_settings"
  SET "github_label_review" = 'review' WHERE "github_label_review" IS NULL;

ALTER TABLE "helpdesk_settings"
  ALTER COLUMN "github_enabled" SET NOT NULL,
  ALTER COLUMN "github_enabled" SET DEFAULT FALSE,
  ALTER COLUMN "github_label_in_progress" SET NOT NULL,
  ALTER COLUMN "github_label_in_progress" SET DEFAULT 'in progress',
  ALTER COLUMN "github_label_review" SET NOT NULL,
  ALTER COLUMN "github_label_review" SET DEFAULT 'review';
