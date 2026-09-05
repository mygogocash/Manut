-- IT Operations hardening: license utilization (Phase 2), document
-- attachments (Phase 3), renewal decision workflow (Phase 4).
-- Idempotent: ADD COLUMN IF NOT EXISTS + guarded FK.

-- ── Phase 3: vendor document attachments ──
ALTER TABLE "it_vendors" ADD COLUMN IF NOT EXISTS "attachments" JSONB;

-- ── Phase 2: license utilization (source counts; derived values computed on read) ──
ALTER TABLE "it_subscriptions" ADD COLUMN IF NOT EXISTS "total_seats" INTEGER;
ALTER TABLE "it_subscriptions" ADD COLUMN IF NOT EXISTS "assigned_seats" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "it_subscriptions" ADD COLUMN IF NOT EXISTS "active_seats" INTEGER NOT NULL DEFAULT 0;

-- ── Phase 4: renewal decision workflow ──
ALTER TABLE "it_subscriptions" ADD COLUMN IF NOT EXISTS "renewal_decision" TEXT;
ALTER TABLE "it_subscriptions" ADD COLUMN IF NOT EXISTS "renewal_decision_at" TIMESTAMP(3);
ALTER TABLE "it_subscriptions" ADD COLUMN IF NOT EXISTS "renewal_decision_by" UUID;
ALTER TABLE "it_subscriptions" ADD COLUMN IF NOT EXISTS "renewal_decision_notes" TEXT;

-- ── Phase 3: subscription document attachments ──
ALTER TABLE "it_subscriptions" ADD COLUMN IF NOT EXISTS "attachments" JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'it_subscriptions_renewal_decision_by_fkey'
  ) THEN
    ALTER TABLE "it_subscriptions"
      ADD CONSTRAINT "it_subscriptions_renewal_decision_by_fkey"
      FOREIGN KEY ("renewal_decision_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
