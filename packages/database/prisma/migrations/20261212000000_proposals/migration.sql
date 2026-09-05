-- Product proposals: ideas, change requests, and anything else product-related
-- that needs a decision.
--
-- Three tables, all new. Nothing existing is altered except one nullable foreign
-- key from proposals back to projects, so this cannot affect the Project CRM or
-- the project request workflow.
--
-- Idempotent throughout: every CREATE is guarded, and the foreign keys are added
-- inside DO blocks that check the catalog first, so a partial apply can be
-- re-run safely.

-- ── proposals ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "proposals" (
  "id"                text        NOT NULL,
  "title"             text        NOT NULL,
  "description"       text        NOT NULL,
  -- idea | change_request | other. Text, not an enum: a new type should not
  -- need a migration.
  "type"              text        NOT NULL DEFAULT 'idea',
  "project_id"        text,
  "priority"          text,
  "raised_by_id"      uuid        NOT NULL,
  -- pending_pm_review | awaiting_information | pending_ceo_approval |
  -- approved | declined. Validated in code, same reasoning as `type`.
  "status"            text        NOT NULL DEFAULT 'pending_pm_review',
  -- Written only on a real status change, so time-in-stage stays exact.
  "status_changed_at" timestamptz(6),
  "created_at"        timestamp(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        timestamp(3)   NOT NULL,
  CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "proposals_status_idx" ON "proposals" ("status");
CREATE INDEX IF NOT EXISTS "proposals_raised_by_id_idx" ON "proposals" ("raised_by_id");
CREATE INDEX IF NOT EXISTS "proposals_project_id_idx" ON "proposals" ("project_id");
-- The queue orders by recency within a status.
CREATE INDEX IF NOT EXISTS "proposals_status_created_at_idx" ON "proposals" ("status", "created_at");

-- ── proposal_information_requests ───────────────────────────────────────
-- A child table rather than a column on `proposals`: a reviewer can ask several
-- people at once, and one `assigned_to` column cannot express that.
CREATE TABLE IF NOT EXISTS "proposal_information_requests" (
  "id"               text      NOT NULL,
  "proposal_id"      text      NOT NULL,
  "asked_by_id"      uuid      NOT NULL,
  "assigned_to_id"   uuid      NOT NULL,
  -- Which stage the question came from, so the proposal knows where to return
  -- once every open question is answered. Both tiers can ask.
  "raised_at_status" text      NOT NULL,
  "question"         text      NOT NULL,
  "response"         text,
  "created_at"       timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- The authoritative "answered" marker. An answer could legitimately be an
  -- empty string, so `response IS NULL` is not a safe test.
  "responded_at"     timestamptz(6),
  CONSTRAINT "proposal_information_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "proposal_information_requests_proposal_id_created_at_idx"
  ON "proposal_information_requests" ("proposal_id", "created_at");
-- Drives "questions waiting on me".
CREATE INDEX IF NOT EXISTS "proposal_information_requests_assigned_to_id_responded_at_idx"
  ON "proposal_information_requests" ("assigned_to_id", "responded_at");

-- ── proposal_transitions ────────────────────────────────────────────────
-- Append-only. Nothing in the application updates or deletes a row here.
CREATE TABLE IF NOT EXISTS "proposal_transitions" (
  "id"          text      NOT NULL,
  "proposal_id" text      NOT NULL,
  "from_status" text,
  "to_status"   text      NOT NULL,
  "actor_id"    uuid,
  -- pass | decline | question. Null for system moves, because "declined" alone
  -- does not say whether a human chose it or a rule produced it.
  "choice"      text,
  "comment"     text,
  "created_at"  timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "proposal_transitions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "proposal_transitions_proposal_id_created_at_idx"
  ON "proposal_transitions" ("proposal_id", "created_at");

-- ── Foreign keys ────────────────────────────────────────────────────────
-- Guarded so a re-run does not fail on an already-present constraint.
--
-- proposals -> projects is SET NULL rather than CASCADE: the decision history is
-- worth keeping after the project is gone. The two child tables CASCADE, because
-- a question or a transition has no meaning without its proposal.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposals_project_id_fkey'
  ) THEN
    ALTER TABLE "proposals"
      ADD CONSTRAINT "proposals_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proposal_information_requests_proposal_id_fkey'
  ) THEN
    ALTER TABLE "proposal_information_requests"
      ADD CONSTRAINT "proposal_information_requests_proposal_id_fkey"
      FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proposal_transitions_proposal_id_fkey'
  ) THEN
    ALTER TABLE "proposal_transitions"
      ADD CONSTRAINT "proposal_transitions_proposal_id_fkey"
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


ALTER TABLE "proposals"
  ALTER COLUMN "created_at" SET DATA TYPE timestamp(3);

ALTER TABLE "proposals"
  ALTER COLUMN "updated_at" SET DATA TYPE timestamp(3);

ALTER TABLE "proposals"
  ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "proposal_information_requests"
  ALTER COLUMN "created_at" SET DATA TYPE timestamp(3);

ALTER TABLE "proposal_transitions"
  ALTER COLUMN "created_at" SET DATA TYPE timestamp(3);
