-- Vendors / clients / suppliers directory. Mirrors the "Contact Lists"
-- xlsx that finance exports from the Thai accounting system today.
-- Entity-scoped (most rows live on TBH Thailand but the schema is
-- ready for other entities).
--
-- Idempotent: every CREATE / ALTER guards itself so a partial-apply
-- incident can re-run cleanly.

CREATE TABLE IF NOT EXISTS "vendors" (
  "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
  "entity_id"         TEXT         NOT NULL,
  "contact_type"      TEXT,
  "contact_id"        TEXT,
  "business_type"     TEXT,
  "business_location" TEXT,
  "name"              TEXT         NOT NULL,
  "address_th"        TEXT,
  "address_en"        TEXT,
  "address2"          TEXT,
  "address3"          TEXT,
  "zip_code"          TEXT,
  "tax_id"            TEXT,
  "branch_code"       TEXT,
  "branch"            TEXT,
  "contact_name"      TEXT,
  "email"             TEXT,
  "mobile"            TEXT,
  "credit_days"       INTEGER,
  "phone"             TEXT,
  "fax_number"        TEXT,
  "notes"             TEXT,
  "is_active"         BOOLEAN      NOT NULL DEFAULT TRUE,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vendors_entity_id_is_active_idx"
  ON "vendors"("entity_id", "is_active");

CREATE INDEX IF NOT EXISTS "vendors_entity_id_name_idx"
  ON "vendors"("entity_id", "name");

CREATE INDEX IF NOT EXISTS "vendors_contact_id_idx"
  ON "vendors"("contact_id");

CREATE INDEX IF NOT EXISTS "vendors_tax_id_idx"
  ON "vendors"("tax_id");

DO $$ BEGIN
  ALTER TABLE "vendors"
    ADD CONSTRAINT "vendors_entity_id_fkey"
    FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
    ON UPDATE CASCADE ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
