-- Fixed Asset Register (Accounting) — Phase 1 foundation.
-- Three additive tables: the register, the disposal/write-off approval record,
-- and the admin-editable category list. No journal posting in Phase 1 (that is
-- Phase 2); depreciation is computed on demand, not stored. entity_id is a bare
-- scalar (no FK to entities) to keep the change self-contained, matching the
-- TaxFiling / CustomerAdvance convention. Fully additive + idempotent — safe to
-- re-run after a partial apply.

CREATE TABLE IF NOT EXISTS "fixed_assets" (
    "id" UUID NOT NULL,
    "entity_id" TEXT NOT NULL,
    "asset_no" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_th" TEXT,
    "category_code" TEXT NOT NULL,
    "asset_class" TEXT NOT NULL,
    "location" TEXT,
    "assigned_user" TEXT,
    "supplier" TEXT,
    "serial_no" TEXT,
    "purchase_date" DATE NOT NULL,
    "start_date" DATE NOT NULL,
    "useful_life_months" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "purchase_price" DECIMAL(15,2) NOT NULL,
    "opening_book_value" DECIMAL(15,2),
    "opening_as_of_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "disposal_date" DATE,
    "selling_price" DECIMAL(15,2),
    "notes" TEXT,
    "link_group" TEXT,
    "created_by" UUID NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fixed_assets_entity_id_asset_no_key"
  ON "fixed_assets" ("entity_id", "asset_no");
CREATE INDEX IF NOT EXISTS "fixed_assets_entity_id_status_idx"
  ON "fixed_assets" ("entity_id", "status");
CREATE INDEX IF NOT EXISTS "fixed_assets_entity_id_category_code_idx"
  ON "fixed_assets" ("entity_id", "category_code");
CREATE INDEX IF NOT EXISTS "fixed_assets_deleted_at_idx"
  ON "fixed_assets" ("deleted_at");
CREATE INDEX IF NOT EXISTS "fixed_assets_created_by_idx"
  ON "fixed_assets" ("created_by");

CREATE TABLE IF NOT EXISTS "fixed_asset_disposals" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "entity_id" TEXT NOT NULL,
    "disposal_type" TEXT NOT NULL,
    "disposal_date" DATE NOT NULL,
    "units_disposed" INTEGER NOT NULL DEFAULT 1,
    "proceeds" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "nbv_disposed" DECIMAL(15,2),
    "gain_loss" DECIMAL(15,2),
    "reason" TEXT,
    "link_group_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_by" UUID NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "rejected_by" UUID,
    "rejected_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fixed_asset_disposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fixed_asset_disposals_entity_id_status_idx"
  ON "fixed_asset_disposals" ("entity_id", "status");
CREATE INDEX IF NOT EXISTS "fixed_asset_disposals_asset_id_idx"
  ON "fixed_asset_disposals" ("asset_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fixed_asset_disposals_asset_id_fkey'
  ) THEN
    ALTER TABLE "fixed_asset_disposals"
      ADD CONSTRAINT "fixed_asset_disposals_asset_id_fkey"
      FOREIGN KEY ("asset_id") REFERENCES "fixed_assets"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "fixed_asset_categories" (
    "id" UUID NOT NULL,
    "entity_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_th" TEXT,
    "asset_class" TEXT NOT NULL,
    "useful_life_months" INTEGER NOT NULL,
    "asset_gl_account_id" TEXT,
    "depreciation_gl_account_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fixed_asset_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fixed_asset_categories_entity_id_code_key"
  ON "fixed_asset_categories" ("entity_id", "code");
CREATE INDEX IF NOT EXISTS "fixed_asset_categories_entity_id_is_active_idx"
  ON "fixed_asset_categories" ("entity_id", "is_active");
