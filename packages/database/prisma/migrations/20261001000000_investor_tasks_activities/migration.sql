-- Investor-scoped Tasks + Activities (Investor CRM Phase 2).
-- Idempotent: CREATE ... IF NOT EXISTS + guarded constraint adds so a
-- partial-apply or re-run is safe (CLAUDE.md migration rule).

CREATE TABLE IF NOT EXISTS "investor_tasks" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "due_date" DATE NOT NULL,
    "investor_id" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "investor_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "investor_activities" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "duration_mins" INTEGER,
    "investor_id" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "investor_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "investor_tasks_investor_id_idx" ON "investor_tasks"("investor_id");
CREATE INDEX IF NOT EXISTS "investor_tasks_owner_id_status_due_date_idx" ON "investor_tasks"("owner_id", "status", "due_date");
CREATE INDEX IF NOT EXISTS "investor_activities_investor_id_idx" ON "investor_activities"("investor_id");
CREATE INDEX IF NOT EXISTS "investor_activities_occurred_at_idx" ON "investor_activities"("occurred_at");

DO $$ BEGIN
  ALTER TABLE "investor_tasks" ADD CONSTRAINT "investor_tasks_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "investor_tasks" ADD CONSTRAINT "investor_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "investor_activities" ADD CONSTRAINT "investor_activities_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "investor_activities" ADD CONSTRAINT "investor_activities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
