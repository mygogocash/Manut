-- Travel approval chain: org-wide ordered stages + per-request decision snapshot.

ALTER TABLE "travel_requests"
  ADD COLUMN IF NOT EXISTS "current_step_order" INTEGER;

CREATE TABLE IF NOT EXISTS "travel_approval_steps" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order"            INTEGER NOT NULL,
  "name"             VARCHAR(100) NOT NULL,
  "description"      TEXT,
  "approver_type"    TEXT NOT NULL DEFAULT 'manager',
  "approver_user_id" UUID,
  "is_active"        BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "travel_approval_steps_order_key" UNIQUE ("order"),
  CONSTRAINT "travel_approval_steps_user_fk"
    FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "travel_approval_decisions" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "travel_request_id" UUID NOT NULL,
  "order"             INTEGER NOT NULL,
  "name"              VARCHAR(100) NOT NULL,
  "approver_type"     TEXT NOT NULL,
  "approver_user_id"  UUID,
  "status"            TEXT NOT NULL DEFAULT 'pending',
  "decided_by_id"     UUID,
  "decided_at"        TIMESTAMP(3),
  "notes"             TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "travel_approval_decisions_request_order_key"
    UNIQUE ("travel_request_id", "order"),
  CONSTRAINT "travel_approval_decisions_request_fk"
    FOREIGN KEY ("travel_request_id") REFERENCES "travel_requests"("id") ON DELETE CASCADE,
  CONSTRAINT "travel_approval_decisions_approver_fk"
    FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "travel_approval_decisions_decided_by_fk"
    FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "travel_approval_decisions_approver_status_idx"
  ON "travel_approval_decisions" ("approver_user_id", "status");
CREATE INDEX IF NOT EXISTS "travel_approval_decisions_request_idx"
  ON "travel_approval_decisions" ("travel_request_id");
