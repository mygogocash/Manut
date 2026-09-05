-- Extends `assets` to cover the IT-asset-management spreadsheet
-- (laptops, mobiles, peripherals, software, accounting register).
-- All additions are nullable / defaulted, so the migration is safe to
-- re-run and does not touch existing rows.

ALTER TABLE "assets"
  ADD COLUMN IF NOT EXISTS "manufacturer"        VARCHAR,
  ADD COLUMN IF NOT EXISTS "model"               VARCHAR,
  ADD COLUMN IF NOT EXISTS "colour"              VARCHAR,
  ADD COLUMN IF NOT EXISTS "sub_type"            VARCHAR,
  ADD COLUMN IF NOT EXISTS "operating_system"    VARCHAR,
  ADD COLUMN IF NOT EXISTS "description"         TEXT,
  ADD COLUMN IF NOT EXISTS "support_link"        VARCHAR,
  ADD COLUMN IF NOT EXISTS "active_service_date" DATE,
  ADD COLUMN IF NOT EXISTS "department"          VARCHAR,
  ADD COLUMN IF NOT EXISTS "asset_code"          VARCHAR,
  ADD COLUMN IF NOT EXISTS "version"             VARCHAR,
  ADD COLUMN IF NOT EXISTS "quantity"            INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "useful_life_months"  INTEGER,
  ADD COLUMN IF NOT EXISTS "book_value"          DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS "disposal_date"       DATE,
  ADD COLUMN IF NOT EXISTS "selling_price"       DECIMAL(15, 2);

CREATE INDEX IF NOT EXISTS "assets_type_idx"        ON "assets" ("type");
CREATE INDEX IF NOT EXISTS "assets_status_idx"      ON "assets" ("status");
CREATE INDEX IF NOT EXISTS "assets_asset_code_idx"  ON "assets" ("asset_code");
