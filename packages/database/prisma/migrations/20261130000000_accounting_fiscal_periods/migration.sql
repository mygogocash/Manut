-- M14 — fiscal period lock.
--
-- A closed month rejects new/edited postings dated into it. Default-open: the
-- table starts empty, so nothing is blocked until an admin closes a month.
-- Additive + idempotent.

CREATE TABLE IF NOT EXISTS "fiscal_periods" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'closed',
    "note" TEXT,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_periods_entity_id_year_month_key"
  ON "fiscal_periods" ("entity_id", "year", "month");

CREATE INDEX IF NOT EXISTS "fiscal_periods_entity_id_idx"
  ON "fiscal_periods" ("entity_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fiscal_periods_entity_id_fkey'
  ) THEN
    ALTER TABLE "fiscal_periods"
      ADD CONSTRAINT "fiscal_periods_entity_id_fkey"
      FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
