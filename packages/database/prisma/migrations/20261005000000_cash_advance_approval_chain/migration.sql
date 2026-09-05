-- Cash Advance approval chain (mirrors travel_approval_steps /
-- travel_approval_decisions). Idempotent: IF NOT EXISTS + guarded FKs.

ALTER TABLE "cash_advance_requests" ADD COLUMN IF NOT EXISTS "current_step_order" INTEGER;

CREATE TABLE IF NOT EXISTS "cash_advance_approval_steps" (
    "id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "approver_type" TEXT NOT NULL DEFAULT 'manager',
    "approver_user_id" UUID,
    "skip_when_submitter_ids" JSONB NOT NULL DEFAULT '[]',
    "only_when_submitter_ids" JSONB NOT NULL DEFAULT '[]',
    "payout_mode_filter" JSONB NOT NULL DEFAULT '[]',
    "amount_min" DECIMAL(15,2),
    "amount_max" DECIMAL(15,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cash_advance_approval_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cash_advance_approval_steps_order_key" ON "cash_advance_approval_steps"("order");

CREATE TABLE IF NOT EXISTS "cash_advance_approval_decisions" (
    "id" UUID NOT NULL,
    "cash_advance_request_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "approver_type" TEXT NOT NULL,
    "approver_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_advance_approval_decisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cash_advance_approval_decisions_cash_advance_request_id_order_key" ON "cash_advance_approval_decisions"("cash_advance_request_id", "order");
CREATE INDEX IF NOT EXISTS "cash_advance_approval_decisions_approver_user_id_status_idx" ON "cash_advance_approval_decisions"("approver_user_id", "status");
CREATE INDEX IF NOT EXISTS "cash_advance_approval_decisions_cash_advance_request_id_idx" ON "cash_advance_approval_decisions"("cash_advance_request_id");

DO $$ BEGIN
  ALTER TABLE "cash_advance_approval_steps" ADD CONSTRAINT "cash_advance_approval_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cash_advance_approval_decisions" ADD CONSTRAINT "cash_advance_approval_decisions_cash_advance_request_id_fkey" FOREIGN KEY ("cash_advance_request_id") REFERENCES "cash_advance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cash_advance_approval_decisions" ADD CONSTRAINT "cash_advance_approval_decisions_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cash_advance_approval_decisions" ADD CONSTRAINT "cash_advance_approval_decisions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
