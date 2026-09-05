-- Sales CRM + Sales Revenue CRM (2026-08-24): admin-editable business-unit
-- tags ("who is taking care of this card") — Onewave / Onewave Revenue / ARIA
-- out of the box, extendable from the UI. Replaces the hardcoded three-way
-- sidebar split from PR #1110 with a data-level tag.
-- Idempotent (CLAUDE.md): safe to re-run / safe after a partial apply.

-- 1. The lookup table. Same shape as crm_lost_reasons / crm_lead_sources.
--    `color` holds a shared Badge VARIANT NAME (not a Tailwind class) so the
--    chip colour resolves through the design system's literal class map.
CREATE TABLE IF NOT EXISTS "crm_business_units" (
  "id"         TEXT         NOT NULL,
  "code"       TEXT         NOT NULL,
  "label"      TEXT         NOT NULL,
  "color"      TEXT         NOT NULL DEFAULT 'grey',
  "is_system"  BOOLEAN      NOT NULL DEFAULT false,
  "is_active"  BOOLEAN      NOT NULL DEFAULT true,
  "sort_order" INTEGER      NOT NULL DEFAULT 100,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_business_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_business_units_code_key"
  ON "crm_business_units" ("code");

CREATE INDEX IF NOT EXISTS "crm_business_units_is_active_sort_order_idx"
  ON "crm_business_units" ("is_active", "sort_order");

-- 2. The tag column on every record surface that gets a filter. Plain text[]
--    with no FK to crm_business_units — deleting a unit is handled in the
--    service (array_remove) rather than by a cascade, so history survives a
--    rename and an orphan code degrades to rendering the raw code.
ALTER TABLE "crm_opportunities"
  ADD COLUMN IF NOT EXISTS "business_units" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "crm_leads"
  ADD COLUMN IF NOT EXISTS "business_units" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "crm_accounts"
  ADD COLUMN IF NOT EXISTS "business_units" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "revenue_opportunities"
  ADD COLUMN IF NOT EXISTS "business_units" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "revenue_leads"
  ADD COLUMN IF NOT EXISTS "business_units" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "revenue_accounts"
  ADD COLUMN IF NOT EXISTS "business_units" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 3. Seed the three units the business asked for. is_system = false on
--    purpose: the ask was explicitly "add more or remove support as well",
--    so an admin must be able to delete these, not just deactivate them.
--    Deterministic ids keep a re-run a no-op even before the unique index
--    on `code` would catch it.
INSERT INTO "crm_business_units"
  ("id", "code", "label", "color", "is_system", "is_active", "sort_order", "created_at", "updated_at")
VALUES
  ('bu_seed_onewave',         'onewave',         'Onewave',         'blue',   false, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('bu_seed_onewave_revenue', 'onewave-revenue', 'Onewave Revenue', 'teal',   false, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('bu_seed_aria',            'aria',            'ARIA',            'violet', false, true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- No backfill: every existing record starts untagged and shows under the
-- "Unassigned" filter until a rep tags it.
