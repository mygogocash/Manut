-- Per-business-unit stage: tables only (schema-only, staging applies via db:push).
--
-- Deliberately NO backfill here. deploy-staging.yml runs
-- `prisma db push --accept-data-loss`, which reconciles the SCHEMA and never
-- executes migration SQL, so an INSERT in this file would populate production
-- and silently skip staging. The backfill lives in
-- apps/api/src/modules/opportunities/opportunity-business-units.repository.ts
-- and runs identically in both environments.

CREATE TABLE IF NOT EXISTS "crm_opportunity_business_units" (
  "id" TEXT NOT NULL,
  "opportunity_id" TEXT NOT NULL,
  "business_unit" TEXT NOT NULL,
  "stage" TEXT NOT NULL DEFAULT 'qualified',
  "probability" INTEGER NOT NULL DEFAULT 20,
  "probability_custom" BOOLEAN NOT NULL DEFAULT false,
  "value" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "close_date" DATE,
  "launch_date" DATE,
  "revenue_launch_date" DATE,
  "lost_reason" TEXT,
  "sort_order_within_stage" INTEGER NOT NULL DEFAULT 0,
  "reminders_sent" JSONB NOT NULL DEFAULT '[]',
  "last_reminder_sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_opportunity_business_units_pkey" PRIMARY KEY ("id")
);

-- Index/constraint names are pinned to <=63 bytes (Postgres's identifier
-- limit) and must match the `map:` arguments in sales-crm.prisma exactly,
-- so `db push` (staging) and this migration (production) agree on the
-- same truncated-safe names instead of silently diverging.
CREATE UNIQUE INDEX IF NOT EXISTS "crm_opportunity_business_units_opportunity_id_business_unit_key"
  ON "crm_opportunity_business_units" ("opportunity_id", "business_unit");
CREATE INDEX IF NOT EXISTS "crm_opportunity_business_units_business_unit_stage_idx"
  ON "crm_opportunity_business_units" ("business_unit", "stage");
CREATE INDEX IF NOT EXISTS "crm_opportunity_business_units_stage_sort_idx"
  ON "crm_opportunity_business_units" ("stage", "sort_order_within_stage");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'crm_opportunity_business_units_opportunity_id_fkey'
  ) THEN
    ALTER TABLE "crm_opportunity_business_units"
      ADD CONSTRAINT "crm_opportunity_business_units_opportunity_id_fkey"
      FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "revenue_opportunity_business_units" (
  "id" TEXT NOT NULL,
  "opportunity_id" TEXT NOT NULL,
  "business_unit" TEXT NOT NULL,
  "stage" TEXT NOT NULL DEFAULT 'qualified',
  "probability" INTEGER NOT NULL DEFAULT 20,
  "probability_custom" BOOLEAN NOT NULL DEFAULT false,
  "value" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "close_date" DATE,
  "launch_date" DATE,
  "revenue_launch_date" DATE,
  "lost_reason" TEXT,
  "sort_order_within_stage" INTEGER NOT NULL DEFAULT 0,
  "reminders_sent" JSONB NOT NULL DEFAULT '[]',
  "last_reminder_sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "revenue_opportunity_business_units_pkey" PRIMARY KEY ("id")
);

-- Index/constraint names are pinned to <=63 bytes (Postgres's identifier
-- limit) and must match the `map:` arguments in sales-revenue-crm.prisma
-- exactly, so `db push` (staging) and this migration (production) agree on
-- the same truncated-safe names instead of silently diverging.
CREATE UNIQUE INDEX IF NOT EXISTS "revenue_opp_business_units_opportunity_id_business_unit_key"
  ON "revenue_opportunity_business_units" ("opportunity_id", "business_unit");
CREATE INDEX IF NOT EXISTS "revenue_opp_business_units_business_unit_stage_idx"
  ON "revenue_opportunity_business_units" ("business_unit", "stage");
CREATE INDEX IF NOT EXISTS "revenue_opp_business_units_stage_sort_idx"
  ON "revenue_opportunity_business_units" ("stage", "sort_order_within_stage");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'revenue_opportunity_business_units_opportunity_id_fkey'
  ) THEN
    ALTER TABLE "revenue_opportunity_business_units"
      ADD CONSTRAINT "revenue_opportunity_business_units_opportunity_id_fkey"
      FOREIGN KEY ("opportunity_id") REFERENCES "revenue_opportunities"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
