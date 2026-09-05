-- Configurable approval chains for the Project CRM.
--
-- Scope: project requests and proposals ONLY. The HR and Finance chains
-- (travel, leave, expenses, cash advance, payroll) are untouched — they keep
-- their own *_approval_steps tables and their own HR/Finance permissions.
--
-- Entirely additive and idempotent. Two new columns, three new tables, and a
-- seed that reproduces TODAY'S behaviour exactly, so deploying this changes
-- nothing about how either flow runs until an admin edits a chain.

-- ── Where a record sits in its chain ─────────────────────────────────────
-- Null everywhere on existing rows, which reads as the coded default. Nothing
-- backfills these: a record picks up a step order when it next transitions.

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "current_step_order" integer;

ALTER TABLE "proposals"
  ADD COLUMN IF NOT EXISTS "current_step_order" integer;

-- ── The chains ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "approval_chains" (
  "id"          text                     NOT NULL,
  -- One chain per scope, so routing can never be ambiguous.
  "scope"       varchar(50)              NOT NULL,
  "name"        varchar(100)             NOT NULL,
  "description" text,
  "is_active"   boolean                  NOT NULL DEFAULT true,
  "created_at"  timestamp(3)                NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  timestamp(3)                NOT NULL,
  CONSTRAINT "approval_chains_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "approval_chains_scope_key"
  ON "approval_chains" ("scope");

CREATE TABLE IF NOT EXISTS "approval_chain_steps" (
  "id"               text         NOT NULL,
  "chain_id"         text         NOT NULL,
  "order"            integer      NOT NULL,
  "name"             varchar(100) NOT NULL,
  "description"      text,
  -- The person who decides here. Nullable so removing a user cannot delete a
  -- stage; an unresolvable stage falls back to system admins at runtime.
  "approver_user_id" uuid,
  "is_active"        boolean      NOT NULL DEFAULT true,
  "created_at"       timestamp(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       timestamp(3)    NOT NULL,
  CONSTRAINT "approval_chain_steps_pkey" PRIMARY KEY ("id")
);

-- Reordering parks rows at a high range before renumbering, so this constraint
-- never sees a transient clash.
CREATE UNIQUE INDEX IF NOT EXISTS "approval_chain_steps_chain_id_order_key"
  ON "approval_chain_steps" ("chain_id", "order");
CREATE INDEX IF NOT EXISTS "approval_chain_steps_approver_user_id_idx"
  ON "approval_chain_steps" ("approver_user_id");

-- ── Per-record snapshot ──────────────────────────────────────────────────
-- Taken on submit. Editing a chain must never move a request already in flight.

CREATE TABLE IF NOT EXISTS "approval_chain_decisions" (
  "id"               text         NOT NULL,
  -- Copied, not joined: the chain and its steps may be edited or deleted, and
  -- this row must still say what was actually decided against.
  "scope"            varchar(50)  NOT NULL,
  "project_id"       text,
  "proposal_id"      text,
  "order"            integer      NOT NULL,
  "name"             varchar(100) NOT NULL,
  "approver_user_id" uuid,
  -- pending | approved | rejected | skipped
  "status"           varchar(20)  NOT NULL DEFAULT 'pending',
  -- Who actually acted, which may differ from the named approver when a
  -- super-grant holder steps in. Both are kept for exactly that reason.
  "decided_by_id"    uuid,
  "decided_at"       timestamptz(6),
  "notes"            text,
  "created_at"       timestamp(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_chain_decisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "approval_chain_decisions_project_id_order_key"
  ON "approval_chain_decisions" ("project_id", "order");
CREATE UNIQUE INDEX IF NOT EXISTS "approval_chain_decisions_proposal_id_order_key"
  ON "approval_chain_decisions" ("proposal_id", "order");
CREATE INDEX IF NOT EXISTS "approval_chain_decisions_approver_user_id_status_idx"
  ON "approval_chain_decisions" ("approver_user_id", "status");
CREATE INDEX IF NOT EXISTS "approval_chain_decisions_scope_status_idx"
  ON "approval_chain_decisions" ("scope", "status");

-- Exactly one owner. A decision belonging to both or neither would be a routing
-- bug that silently corrupted somebody's queue, so the database refuses it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'approval_chain_decisions_one_owner_chk'
  ) THEN
    ALTER TABLE "approval_chain_decisions"
      ADD CONSTRAINT "approval_chain_decisions_one_owner_chk"
      CHECK (
        ("project_id" IS NOT NULL AND "proposal_id" IS NULL)
        OR ("project_id" IS NULL AND "proposal_id" IS NOT NULL)
      );
  END IF;
END $$;

-- ── Foreign keys ─────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_chain_steps_chain_id_fkey') THEN
    ALTER TABLE "approval_chain_steps"
      ADD CONSTRAINT "approval_chain_steps_chain_id_fkey"
      FOREIGN KEY ("chain_id") REFERENCES "approval_chains"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_chain_steps_approver_user_id_fkey') THEN
    ALTER TABLE "approval_chain_steps"
      ADD CONSTRAINT "approval_chain_steps_approver_user_id_fkey"
      FOREIGN KEY ("approver_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_chain_decisions_project_id_fkey') THEN
    ALTER TABLE "approval_chain_decisions"
      ADD CONSTRAINT "approval_chain_decisions_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_chain_decisions_proposal_id_fkey') THEN
    ALTER TABLE "approval_chain_decisions"
      ADD CONSTRAINT "approval_chain_decisions_proposal_id_fkey"
      FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_chain_decisions_approver_user_id_fkey') THEN
    ALTER TABLE "approval_chain_decisions"
      ADD CONSTRAINT "approval_chain_decisions_approver_user_id_fkey"
      FOREIGN KEY ("approver_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_chain_decisions_decided_by_id_fkey') THEN
    ALTER TABLE "approval_chain_decisions"
      ADD CONSTRAINT "approval_chain_decisions_decided_by_id_fkey"
      FOREIGN KEY ("decided_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Seed: today's behaviour, as data ─────────────────────────────────────
--
-- The point of this block is that deploying changes NOTHING. Each chain is
-- seeded to match what the code does now, reading the people out of the
-- SystemSetting rows that configure them today:
--
--   project requests  1 stage  <- project-workflow.default_approver
--   proposals         2 stages <- proposals.first_reviewer, proposals.final_approver
--
-- A setting that is absent, or that names a user who no longer exists, seeds the
-- stage with no approver. That is the same "fall back to permission holders"
-- state the code already handles, not a new failure mode.
--
-- Guarded on the chain not already existing, so re-running cannot duplicate
-- stages or overwrite an admin's later edits.

DO $$
DECLARE
  v_chain_id text;
  v_user_id  uuid;
BEGIN
  -- Project requests: one stage, the PM gate.
  IF NOT EXISTS (SELECT 1 FROM "approval_chains" WHERE "scope" = 'project_request') THEN
    v_chain_id := gen_random_uuid()::text;
    -- `updated_at` is NOT NULL with no DB default (Prisma's @updatedAt is
    -- client-side), so every seed INSERT must name it explicitly.
    INSERT INTO "approval_chains" ("id", "scope", "name", "description", "updated_at")
    VALUES (
      v_chain_id,
      'project_request',
      'Project request approval',
      'Stages a project request passes before development can start.',
      now()
    );

    SELECT u."id" INTO v_user_id
    FROM "system_settings" s
    JOIN "users" u ON u."id" = (s."value" ->> 'userId')::uuid
    WHERE s."key" = 'project-workflow.default_approver';

    INSERT INTO "approval_chain_steps" ("id", "chain_id", "order", "name", "description", "approver_user_id", "updated_at")
    VALUES (
      gen_random_uuid()::text,
      v_chain_id,
      1,
      'Project Manager approval',
      'The single gate. Escalation to a named person stays available at this stage.',
      v_user_id,
      now()
    );
  END IF;

  v_user_id := NULL;

  -- Proposals: the two tiers that were previously fixed in code.
  IF NOT EXISTS (SELECT 1 FROM "approval_chains" WHERE "scope" = 'proposal') THEN
    v_chain_id := gen_random_uuid()::text;
    INSERT INTO "approval_chains" ("id", "scope", "name", "description", "updated_at")
    VALUES (
      v_chain_id,
      'proposal',
      'Proposal approval',
      'Stages a proposal passes before it is approved.',
      now()
    );

    SELECT u."id" INTO v_user_id
    FROM "system_settings" s
    JOIN "users" u ON u."id" = (s."value" ->> 'userId')::uuid
    WHERE s."key" = 'proposals.first_reviewer';

    INSERT INTO "approval_chain_steps" ("id", "chain_id", "order", "name", "description", "approver_user_id", "updated_at")
    VALUES (
      gen_random_uuid()::text,
      v_chain_id,
      1,
      'First review',
      'Sees every new proposal, and is copied on everything that happens after.',
      v_user_id,
      now()
    );

    v_user_id := NULL;
    SELECT u."id" INTO v_user_id
    FROM "system_settings" s
    JOIN "users" u ON u."id" = (s."value" ->> 'userId')::uuid
    WHERE s."key" = 'proposals.final_approver';

    INSERT INTO "approval_chain_steps" ("id", "chain_id", "order", "name", "description", "approver_user_id", "updated_at")
    VALUES (
      gen_random_uuid()::text,
      v_chain_id,
      2,
      'Final approval',
      'Decides once the first reviewer has passed it on.',
      v_user_id,
      now()
    );
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


ALTER TABLE "approval_chains"
  ALTER COLUMN "created_at" SET DATA TYPE timestamp(3);

ALTER TABLE "approval_chains"
  ALTER COLUMN "updated_at" SET DATA TYPE timestamp(3);

ALTER TABLE "approval_chains"
  ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "approval_chain_steps"
  ALTER COLUMN "created_at" SET DATA TYPE timestamp(3);

ALTER TABLE "approval_chain_steps"
  ALTER COLUMN "updated_at" SET DATA TYPE timestamp(3);

ALTER TABLE "approval_chain_steps"
  ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "approval_chain_decisions"
  ALTER COLUMN "created_at" SET DATA TYPE timestamp(3);
