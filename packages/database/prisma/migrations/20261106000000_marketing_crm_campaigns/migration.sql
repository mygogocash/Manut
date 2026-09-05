-- Marketing CRM - Campaign CRM (Phase 2). Idempotent: CREATE TABLE IF NOT
-- EXISTS + guarded FKs + NOT EXISTS permission / lever seeding.

CREATE TABLE IF NOT EXISTS "mkt_campaigns" (
    "id" UUID NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "campaign_date" DATE NOT NULL,
    "hours" DOUBLE PRECISION,
    "owner_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'planned',
    "country" VARCHAR(100),
    "product" VARCHAR(150),
    "channel" VARCHAR(100),
    "campaign_type" VARCHAR(100),
    "objective" TEXT,
    "target_audience" TEXT,
    "expected_reach" INTEGER,
    "actual_reach" INTEGER,
    "budget" DECIMAL(15,2),
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mkt_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mkt_campaigns_campaign_date_idx" ON "mkt_campaigns"("campaign_date");
CREATE INDEX IF NOT EXISTS "mkt_campaigns_status_idx" ON "mkt_campaigns"("status");
CREATE INDEX IF NOT EXISTS "mkt_campaigns_owner_id_idx" ON "mkt_campaigns"("owner_id");

CREATE TABLE IF NOT EXISTS "mkt_levers" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mkt_levers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mkt_levers_name_key" ON "mkt_levers"("name");
CREATE INDEX IF NOT EXISTS "mkt_levers_is_active_idx" ON "mkt_levers"("is_active");

CREATE TABLE IF NOT EXISTS "mkt_campaign_levers" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "lever_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mkt_campaign_levers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mkt_campaign_levers_campaign_id_lever_id_key" ON "mkt_campaign_levers"("campaign_id", "lever_id");
CREATE INDEX IF NOT EXISTS "mkt_campaign_levers_campaign_id_idx" ON "mkt_campaign_levers"("campaign_id");
CREATE INDEX IF NOT EXISTS "mkt_campaign_levers_lever_id_idx" ON "mkt_campaign_levers"("lever_id");

CREATE TABLE IF NOT EXISTS "mkt_creatives" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "kind" VARCHAR(20) NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'upload',
    "name" VARCHAR(300) NOT NULL,
    "url" TEXT NOT NULL,
    "mime_type" VARCHAR(150),
    "size" INTEGER,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mkt_creatives_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mkt_creatives_campaign_id_version_idx" ON "mkt_creatives"("campaign_id", "version");

CREATE TABLE IF NOT EXISTS "mkt_predictions" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "format" VARCHAR(10) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "url" TEXT NOT NULL,
    "mime_type" VARCHAR(150),
    "size" INTEGER,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mkt_predictions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mkt_predictions_campaign_id_created_at_idx" ON "mkt_predictions"("campaign_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mkt_campaigns_owner_id_fkey') THEN
    ALTER TABLE "mkt_campaigns" ADD CONSTRAINT "mkt_campaigns_owner_id_fkey"
      FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mkt_campaigns_created_by_fkey') THEN
    ALTER TABLE "mkt_campaigns" ADD CONSTRAINT "mkt_campaigns_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mkt_campaign_levers_campaign_id_fkey') THEN
    ALTER TABLE "mkt_campaign_levers" ADD CONSTRAINT "mkt_campaign_levers_campaign_id_fkey"
      FOREIGN KEY ("campaign_id") REFERENCES "mkt_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mkt_campaign_levers_lever_id_fkey') THEN
    ALTER TABLE "mkt_campaign_levers" ADD CONSTRAINT "mkt_campaign_levers_lever_id_fkey"
      FOREIGN KEY ("lever_id") REFERENCES "mkt_levers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mkt_creatives_campaign_id_fkey') THEN
    ALTER TABLE "mkt_creatives" ADD CONSTRAINT "mkt_creatives_campaign_id_fkey"
      FOREIGN KEY ("campaign_id") REFERENCES "mkt_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mkt_creatives_uploaded_by_fkey') THEN
    ALTER TABLE "mkt_creatives" ADD CONSTRAINT "mkt_creatives_uploaded_by_fkey"
      FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mkt_predictions_campaign_id_fkey') THEN
    ALTER TABLE "mkt_predictions" ADD CONSTRAINT "mkt_predictions_campaign_id_fkey"
      FOREIGN KEY ("campaign_id") REFERENCES "mkt_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mkt_predictions_uploaded_by_fkey') THEN
    ALTER TABLE "mkt_predictions" ADD CONSTRAINT "mkt_predictions_uploaded_by_fkey"
      FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed campaign permissions to Admin + Manager.
INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, code
FROM "roles" r
CROSS JOIN (VALUES
  ('marketing:campaign:view'),
  ('marketing:campaign:create'),
  ('marketing:campaign:update'),
  ('marketing:campaign:delete')
) AS p(code)
WHERE ((r.is_system = TRUE AND r.name = 'Admin') OR r.name = 'Manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_code = p.code
  );

-- Seed a starter set of admin-configurable levers.
INSERT INTO "mkt_levers" ("id", "name", "is_active", "sort_order", "created_at", "updated_at")
SELECT * FROM (VALUES
  (gen_random_uuid()::text, 'Push', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Banner', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'SMS', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Email', true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'WhatsApp', true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Telegram', true, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
) AS seed(id, name, is_active, sort_order, created_at, updated_at)
WHERE NOT EXISTS (SELECT 1 FROM "mkt_levers");
