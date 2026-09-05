-- Visa checklists (2026-06-12): per-visa-type templates + per-record items.
-- Idempotent (CLAUDE.md).

CREATE TABLE IF NOT EXISTS "visa_checklist_templates" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "visa_type"  TEXT         NOT NULL,
  "country"    TEXT,
  "name"       TEXT         NOT NULL,
  "items"      JSONB        NOT NULL DEFAULT '[]',
  "is_active"  BOOLEAN      NOT NULL DEFAULT true,
  "entity_id"  UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "visa_checklist_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "visa_checklist_templates_visa_type_is_active_idx"
  ON "visa_checklist_templates" ("visa_type", "is_active");

CREATE TABLE IF NOT EXISTS "visa_checklist_items" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "visa_record_id"   UUID         NOT NULL,
  "template_item_id" TEXT         NOT NULL,
  "label"            TEXT         NOT NULL,
  "category"         TEXT         NOT NULL,
  "optional"         BOOLEAN      NOT NULL DEFAULT false,
  "completed"        BOOLEAN      NOT NULL DEFAULT false,
  "completed_at"     TIMESTAMP(3),
  "completed_by_id"  UUID,
  "sort_order"       INTEGER      NOT NULL DEFAULT 0,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "visa_checklist_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "visa_checklist_items_visa_record_id_fkey"
    FOREIGN KEY ("visa_record_id") REFERENCES "visa_records" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "visa_checklist_items_visa_record_id_idx"
  ON "visa_checklist_items" ("visa_record_id");
