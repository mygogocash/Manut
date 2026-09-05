-- Second-level approval for invoices and bills (PRD 9.6).
--
-- A document at or over a configured threshold has to be approved by a SECOND
-- person before it is given a real document number and posted to the ledger.
-- Until then it holds its draft number and no journal entry exists, so nothing
-- has happened that would need unwinding if it is sent back.
--
-- `threshold_applied` is a SNAPSHOT. Every configurable control in this codebase
-- snapshots what was in force at the moment of the decision, because editing a
-- limit must never restate a document that was already approved under the old
-- one. Without it, raising the threshold would retroactively make past
-- two-signature documents look like they never needed two.
--
-- All columns are nullable or defaulted, so existing documents are untouched
-- and behave exactly as before: the feature ships OFF.
--
-- Idempotent.

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "approved_by_1" UUID;
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "approved_at_1" TIMESTAMP(3);
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "approved_by_2" UUID;
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "approved_at_2" TIMESTAMP(3);
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "threshold_applied" DECIMAL(18,2);
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "split_flagged" BOOLEAN NOT NULL DEFAULT false;

-- Queue view: documents waiting on a second signature, oldest first.
CREATE INDEX IF NOT EXISTS "invoices_entity_status_issue_date_idx"
  ON "invoices"("entity_id", "status", "issue_date");
