-- Cash Advance Request module. Mirrors the company's existing Excel
-- form: header + line items + approval trail. Idempotent — every
-- column / table / index is gated on IF NOT EXISTS, so re-running on
-- a partially-applied DB is safe.

CREATE TABLE IF NOT EXISTS "cash_advance_requests" (
  "id"               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "request_number"   SERIAL       UNIQUE,
  "employee_id"      UUID         NOT NULL,
  "entity_id"        TEXT,
  "request_date"     DATE         NOT NULL DEFAULT CURRENT_DATE,
  "position"         TEXT,
  "department"       TEXT,
  "direct_manager"   TEXT,
  "payout_mode"      TEXT         NOT NULL DEFAULT 'bank-transfer',
  "bank_name"        TEXT,
  "bank_country"     TEXT,
  "bank_account_no"  TEXT,
  "swift_code"       TEXT,
  "currency"         VARCHAR(10)  NOT NULL DEFAULT 'THB',
  "status"           TEXT         NOT NULL DEFAULT 'draft',
  "requested_total"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  "approved_total"   DECIMAL(15,2) NOT NULL DEFAULT 0,
  "notes"            TEXT,
  "reject_reason"    TEXT,
  "submitted_at"     TIMESTAMP(3),
  "approved_by"      UUID,
  "approved_at"      TIMESTAMP(3),
  "disbursed_at"     TIMESTAMP(3),
  "cleared_at"       TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "cash_advance_requests_employee_id_status_idx"
  ON "cash_advance_requests" ("employee_id", "status");
CREATE INDEX IF NOT EXISTS "cash_advance_requests_entity_id_idx"
  ON "cash_advance_requests" ("entity_id");
CREATE INDEX IF NOT EXISTS "cash_advance_requests_status_idx"
  ON "cash_advance_requests" ("status");
CREATE INDEX IF NOT EXISTS "cash_advance_requests_request_date_idx"
  ON "cash_advance_requests" ("request_date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cash_advance_requests_employee_id_fkey'
  ) THEN
    ALTER TABLE "cash_advance_requests"
      ADD CONSTRAINT "cash_advance_requests_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cash_advance_requests_entity_id_fkey'
  ) THEN
    ALTER TABLE "cash_advance_requests"
      ADD CONSTRAINT "cash_advance_requests_entity_id_fkey"
      FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cash_advance_requests_approved_by_fkey'
  ) THEN
    ALTER TABLE "cash_advance_requests"
      ADD CONSTRAINT "cash_advance_requests_approved_by_fkey"
      FOREIGN KEY ("approved_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "cash_advance_items" (
  "id"               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "request_id"       UUID         NOT NULL,
  "position"         INT          NOT NULL DEFAULT 1,
  "description"      TEXT         NOT NULL,
  "requested_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "approved_amount"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "cash_advance_items_request_id_position_idx"
  ON "cash_advance_items" ("request_id", "position");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cash_advance_items_request_id_fkey'
  ) THEN
    ALTER TABLE "cash_advance_items"
      ADD CONSTRAINT "cash_advance_items_request_id_fkey"
      FOREIGN KEY ("request_id") REFERENCES "cash_advance_requests"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
