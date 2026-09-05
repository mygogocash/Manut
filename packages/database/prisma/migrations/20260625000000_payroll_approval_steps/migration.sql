-- Org-wide payroll approval chain. Each row is one stage HR runs a
-- payroll run through before flipping it to "approved" for pay-out.
-- Idempotent so partial re-applies stay safe.
CREATE TABLE IF NOT EXISTS "payroll_approval_steps" (
    "id"               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "order"            INTEGER      NOT NULL,
    "name"             VARCHAR(100) NOT NULL,
    "description"      TEXT,
    "approver_user_id" UUID         NOT NULL,
    "is_active"        BOOLEAN      NOT NULL DEFAULT true,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_approval_steps_approver_fk"
        FOREIGN KEY ("approver_user_id")
        REFERENCES "users"("id")
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_approval_steps_order_key"
    ON "payroll_approval_steps" ("order");
