-- Per-policy approver chain for leave types. Each row is one stage.
-- Stages execute in ascending `order`; resolved at request submission
-- time (manager type → submitter's reportingTo, user type → fixed user).

CREATE TABLE IF NOT EXISTS "leave_policy_approvers" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "leave_type_id"    TEXT NOT NULL,
  "order"            INTEGER NOT NULL,
  "approver_type"    TEXT NOT NULL DEFAULT 'manager',
  "approver_user_id" UUID,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leave_policy_approvers_type_order_key"
    UNIQUE ("leave_type_id", "order"),
  CONSTRAINT "leave_policy_approvers_type_fk"
    FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE,
  CONSTRAINT "leave_policy_approvers_user_fk"
    FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "leave_policy_approvers_type_idx"
  ON "leave_policy_approvers" ("leave_type_id");
CREATE INDEX IF NOT EXISTS "leave_policy_approvers_user_idx"
  ON "leave_policy_approvers" ("approver_user_id");
