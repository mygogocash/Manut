-- Fixed Asset Phase 2 tables: remeasurement, transfer, physical count, tax rates.
--
-- All additive. The two columns on fixed_assets default to 0 rather than NULL
-- because they are RUNNING BALANCES the recognition split reads on every event —
-- a null would propagate into the IAS 16.39/40 comparison and silently route a
-- movement to the wrong statement.
--
-- Idempotent throughout so a partial apply can be re-run.

ALTER TABLE "fixed_assets"
  ADD COLUMN IF NOT EXISTS "revaluation_surplus" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "impairment_pl_loss" DECIMAL(15,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "fixed_asset_remeasurements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "asset_id" UUID NOT NULL,
  "entity_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "effective_date" DATE NOT NULL,
  "carrying_before" DECIMAL(15,2) NOT NULL,
  "carrying_after" DECIMAL(15,2) NOT NULL,
  "movement" DECIMAL(15,2) NOT NULL,
  "profit_or_loss" DECIMAL(15,2) NOT NULL,
  "oci" DECIMAL(15,2) NOT NULL,
  "surplus_after" DECIMAL(15,2) NOT NULL,
  "pl_loss_after" DECIMAL(15,2) NOT NULL,
  "capped_at" DECIMAL(15,2),
  "remaining_life_months" INTEGER,
  "reason" TEXT,
  "evidence_url" TEXT,
  "quantity_before" INTEGER,
  "cost_before" DECIMAL(15,2),
  "opening_book_value_before" DECIMAL(15,2),
  "opening_as_of_date_before" DATE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_by" UUID NOT NULL,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_by" UUID,
  "approved_at" TIMESTAMP(3),
  "rejected_by" UUID,
  "rejected_at" TIMESTAMP(3),
  "reject_reason" TEXT,
  "linked_je_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fixed_asset_remeasurements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fixed_asset_remeasurements_entity_id_status_idx"
  ON "fixed_asset_remeasurements" ("entity_id", "status");
CREATE INDEX IF NOT EXISTS "fixed_asset_remeasurements_asset_id_effective_date_idx"
  ON "fixed_asset_remeasurements" ("asset_id", "effective_date");

CREATE TABLE IF NOT EXISTS "fixed_asset_transfers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "asset_id" UUID NOT NULL,
  "entity_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "transfer_date" DATE NOT NULL,
  "from_location" TEXT,
  "to_location" TEXT,
  "from_custodian" TEXT,
  "to_custodian" TEXT,
  "to_entity_id" TEXT,
  "destination_asset_id" UUID,
  "cost_transferred" DECIMAL(15,2),
  "accumulated_transferred" DECIMAL(15,2),
  "remaining_life_months" INTEGER,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_by" UUID NOT NULL,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_by" UUID,
  "approved_at" TIMESTAMP(3),
  "rejected_by" UUID,
  "rejected_at" TIMESTAMP(3),
  "reject_reason" TEXT,
  "linked_je_out_id" TEXT,
  "linked_je_in_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fixed_asset_transfers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fixed_asset_transfers_entity_id_status_idx"
  ON "fixed_asset_transfers" ("entity_id", "status");
CREATE INDEX IF NOT EXISTS "fixed_asset_transfers_asset_id_transfer_date_idx"
  ON "fixed_asset_transfers" ("asset_id", "transfer_date");

CREATE TABLE IF NOT EXISTS "fixed_asset_count_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "entity_id" TEXT NOT NULL,
  "session_no" TEXT NOT NULL,
  "as_of_date" DATE NOT NULL,
  "name" TEXT,
  "location_filter" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "created_by" UUID NOT NULL,
  "closed_by" UUID,
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fixed_asset_count_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fixed_asset_count_sessions_entity_id_session_no_key"
  ON "fixed_asset_count_sessions" ("entity_id", "session_no");
CREATE INDEX IF NOT EXISTS "fixed_asset_count_sessions_entity_id_status_idx"
  ON "fixed_asset_count_sessions" ("entity_id", "status");

CREATE TABLE IF NOT EXISTS "fixed_asset_count_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "asset_id" UUID,
  "scanned_tag" TEXT,
  "expected_quantity" INTEGER NOT NULL,
  "counted_quantity" INTEGER NOT NULL,
  "note" TEXT,
  "counted_by" UUID NOT NULL,
  "counted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fixed_asset_count_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fixed_asset_count_lines_session_id_idx"
  ON "fixed_asset_count_lines" ("session_id");
CREATE INDEX IF NOT EXISTS "fixed_asset_count_lines_asset_id_idx"
  ON "fixed_asset_count_lines" ("asset_id");

CREATE TABLE IF NOT EXISTS "entity_tax_rates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "entity_id" TEXT NOT NULL,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "rate_percent" DECIMAL(6,3) NOT NULL,
  "label" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "entity_tax_rates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "entity_tax_rates_entity_id_effective_from_idx"
  ON "entity_tax_rates" ("entity_id", "effective_from");

-- Foreign keys, each guarded so a re-run is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fixed_asset_remeasurements_asset_id_fkey') THEN
    ALTER TABLE "fixed_asset_remeasurements" ADD CONSTRAINT "fixed_asset_remeasurements_asset_id_fkey"
      FOREIGN KEY ("asset_id") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fixed_asset_remeasurements_linked_je_id_fkey') THEN
    ALTER TABLE "fixed_asset_remeasurements" ADD CONSTRAINT "fixed_asset_remeasurements_linked_je_id_fkey"
      FOREIGN KEY ("linked_je_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fixed_asset_transfers_asset_id_fkey') THEN
    ALTER TABLE "fixed_asset_transfers" ADD CONSTRAINT "fixed_asset_transfers_asset_id_fkey"
      FOREIGN KEY ("asset_id") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fixed_asset_transfers_destination_asset_id_fkey') THEN
    ALTER TABLE "fixed_asset_transfers" ADD CONSTRAINT "fixed_asset_transfers_destination_asset_id_fkey"
      FOREIGN KEY ("destination_asset_id") REFERENCES "fixed_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fixed_asset_count_lines_session_id_fkey') THEN
    ALTER TABLE "fixed_asset_count_lines" ADD CONSTRAINT "fixed_asset_count_lines_session_id_fkey"
      FOREIGN KEY ("session_id") REFERENCES "fixed_asset_count_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fixed_asset_count_lines_asset_id_fkey') THEN
    ALTER TABLE "fixed_asset_count_lines" ADD CONSTRAINT "fixed_asset_count_lines_asset_id_fkey"
      FOREIGN KEY ("asset_id") REFERENCES "fixed_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
