-- OneWave marketing-campaign CRM. Backs the Campaigns tab in Marketing
-- CRM and feeds the OW Dashboard alongside the synced traction sheet.
--
-- Idempotent: CREATE TABLE / INDEX IF NOT EXISTS + guarded FK add so a
-- partial-apply incident can be re-run safely.

-- CreateTable
CREATE TABLE IF NOT EXISTS "marketing_campaigns" (
    "id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "campaign_date" DATE NOT NULL,
    "hours" DOUBLE PRECISION,
    "levers_pulled" TEXT,
    "copy_design" TEXT,
    "prediction_file_url" TEXT,
    "prediction_file_name" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'planned',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "added_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "marketing_campaigns_campaign_date_idx"
    ON "marketing_campaigns"("campaign_date");

-- AddForeignKey (guarded — Postgres has no ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketing_campaigns_added_by_fkey'
  ) THEN
    ALTER TABLE "marketing_campaigns"
      ADD CONSTRAINT "marketing_campaigns_added_by_fkey"
      FOREIGN KEY ("added_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
