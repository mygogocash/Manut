-- Delivery log for proposal notifications.
--
-- Its own table rather than reusing project_workflow_emails, which is keyed to a
-- project: a proposal need not have one, and widening that table's foreign key to
-- nullable would weaken a guarantee the project flow relies on.
--
-- The contract is the same, because the guarantees are what matter:
-- idempotency_key is UNIQUE and claimed BEFORE sending, so duplicate delivery is
-- prevented by the database rather than by an application check that would lose
-- under concurrency.
--
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS "proposal_emails" (
  "id"          text      NOT NULL,
  "proposal_id" text      NOT NULL,
  -- submitted | question_asked | answer_received | decision. Part of the
  -- idempotency key, so one recipient can be mailed about two different events
  -- but never twice about the same one.
  "kind"        text      NOT NULL,
  -- Which status the proposal was in when this was raised, for log context.
  "stage"       text      NOT NULL,
  "recipient"   text      NOT NULL,
  "subject"     text      NOT NULL,
  -- pending | sent | failed
  "status"      text      NOT NULL DEFAULT 'pending',
  "attempts"    integer   NOT NULL DEFAULT 0,
  "error"       text,
  "idempotency_key" text  NOT NULL,
  "created_at"  timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at"     timestamptz(6),
  CONSTRAINT "proposal_emails_pkey" PRIMARY KEY ("id")
);

-- The constraint that actually prevents duplicate sends. Everything else about
-- idempotency is bookkeeping around this line.
CREATE UNIQUE INDEX IF NOT EXISTS "proposal_emails_idempotency_key_key"
  ON "proposal_emails" ("idempotency_key");

CREATE INDEX IF NOT EXISTS "proposal_emails_proposal_id_created_at_idx"
  ON "proposal_emails" ("proposal_id", "created_at");
-- Drives the failed-notification sweep.
CREATE INDEX IF NOT EXISTS "proposal_emails_status_idx"
  ON "proposal_emails" ("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposal_emails_proposal_id_fkey'
  ) THEN
    ALTER TABLE "proposal_emails"
      ADD CONSTRAINT "proposal_emails_proposal_id_fkey"
      FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Converge an already-applied database ─────────────────────────────────
--
-- Prisma maps `DateTime` to timestamp(3), and maintains `@updatedAt` itself, so
-- a bare `timestamp` column or a DB default on updated_at reads as schema drift
-- and makes every `prisma db push` want to retype the column. These statements
-- are no-ops on a fresh database (the CREATEs above already match) and fix one
-- that was created by an earlier version of this file. Idempotent: setting a
-- type a column already has, and dropping a default that is already absent,
-- both succeed.


ALTER TABLE "proposal_emails"
  ALTER COLUMN "created_at" SET DATA TYPE timestamp(3);
