-- Chart of Accounts: control the reuse of a DEACTIVATED account's code or
-- English name.
--
-- The duplicate check only ever looked at ACTIVE accounts, so a code freed by
-- deactivation could be taken by a new, unrelated account. When the old account
-- still carries a balance that makes one code mean two accounts inside the same
-- trial balance, and the cash reconciliation silently stops tying out.
--
-- The application now BLOCKS that case and requires an explicit acknowledgement
-- for the harmless one (old account squared off at zero). These columns record
-- the outcome so an auditor can see, years later, which account a code referred
-- to and over which period, and who accepted the reuse.
--
-- Idempotent: every statement is IF NOT EXISTS / guarded, so a partial apply can
-- be re-run safely.

-- When isActive last flipped to false. Null for accounts deactivated before this
-- column existed — deliberately NOT back-filled with a guess, because the
-- warning text quotes this date to a human and an invented date is worse than an
-- absent one. The UI renders "unknown" for null.
ALTER TABLE "chart_of_accounts"
  ADD COLUMN IF NOT EXISTS "deactivated_at" TIMESTAMP(3);

-- The account whose code or English name this one reused, plus who accepted the
-- reuse and when. All null on every existing row: nothing has been created
-- through the acknowledgement path yet.
ALTER TABLE "chart_of_accounts"
  ADD COLUMN IF NOT EXISTS "reused_from_account_id" TEXT;
ALTER TABLE "chart_of_accounts"
  ADD COLUMN IF NOT EXISTS "reuse_acknowledged_by" UUID;
ALTER TABLE "chart_of_accounts"
  ADD COLUMN IF NOT EXISTS "reuse_acknowledged_at" TIMESTAMP(3);

-- Self-reference. ON DELETE SET NULL rather than CASCADE: losing the pointer
-- degrades the audit trail, but cascading would delete a live account because
-- its long-dead predecessor was removed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chart_of_accounts_reused_from_account_id_fkey'
  ) THEN
    ALTER TABLE "chart_of_accounts"
      ADD CONSTRAINT "chart_of_accounts_reused_from_account_id_fkey"
      FOREIGN KEY ("reused_from_account_id")
      REFERENCES "chart_of_accounts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "chart_of_accounts_reused_from_account_id_idx"
  ON "chart_of_accounts"("reused_from_account_id");
