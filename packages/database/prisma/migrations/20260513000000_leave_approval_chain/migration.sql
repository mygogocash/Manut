-- Leave approval chain. Mirrors the travel/expense chains: an
-- admin-managed list of ordered steps, snapshotted to per-request
-- decisions on submit so editing the chain later doesn't rewrite
-- in-flight requests.

ALTER TABLE "leave_requests"
  ADD COLUMN IF NOT EXISTS "current_step_order" INTEGER;

CREATE TABLE IF NOT EXISTS "leave_approval_steps" (
  "id"                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "order"                    INTEGER      NOT NULL,
  "name"                     VARCHAR(100) NOT NULL,
  "description"              TEXT,
  "approver_type"            TEXT         NOT NULL DEFAULT 'manager',
  "approver_user_id"         UUID,
  "skip_when_submitter_ids"  JSONB        NOT NULL DEFAULT '[]'::jsonb,
  "only_when_submitter_ids"  JSONB        NOT NULL DEFAULT '[]'::jsonb,
  "is_active"                BOOLEAN      NOT NULL DEFAULT TRUE,
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "leave_approval_steps_approver_fk"
    FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_approval_steps_order_uq"
  ON "leave_approval_steps" ("order");

CREATE TABLE IF NOT EXISTS "leave_approval_decisions" (
  "id"                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "leave_request_id"    UUID         NOT NULL,
  "order"               INTEGER      NOT NULL,
  "name"                VARCHAR(100) NOT NULL,
  "approver_type"       TEXT         NOT NULL,
  "approver_user_id"    UUID,
  "status"              TEXT         NOT NULL DEFAULT 'pending',
  "decided_by_id"       UUID,
  "decided_at"          TIMESTAMP(3),
  "notes"               TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "leave_approval_decisions_request_fk"
    FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE,
  CONSTRAINT "leave_approval_decisions_approver_fk"
    FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "leave_approval_decisions_decided_by_fk"
    FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_approval_decisions_request_order_uq"
  ON "leave_approval_decisions" ("leave_request_id", "order");

CREATE INDEX IF NOT EXISTS "leave_approval_decisions_approver_status_idx"
  ON "leave_approval_decisions" ("approver_user_id", "status");

CREATE INDEX IF NOT EXISTS "leave_approval_decisions_request_idx"
  ON "leave_approval_decisions" ("leave_request_id");
