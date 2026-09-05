-- Investor tags: a searchable, admin-editable label set on investors.
--
-- Driven by an investment-team ask (Yanni, 2026-08-26): batches imported
-- from outreach lists need a tag "so we can search for them when this list
-- grows to thousands". That requirement is why this is an indexed array
-- column and not free text in a note.
--
-- Mirrors 20261224000000_crm_business_units. Every statement is guarded so
-- a partial apply can be re-run safely (CLAUDE.md).

-- 1. The tag array on investors. No FK to investor_tags — rows hold the code
--    as an open string, so the catalog stays freely editable.
ALTER TABLE "investors"
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 2. GIN index so `tags @> ARRAY['x']` (Prisma's `has`) stays an index scan
--    rather than a sequential one. Prisma's schema language cannot express
--    a GIN index, so it lives here and NOT in schema.prisma — meaning a
--    `prisma db push` (how staging syncs) will NOT create it. Only a real
--    migrate deploy does.
CREATE INDEX IF NOT EXISTS "investors_tags_gin_idx"
  ON "investors" USING GIN ("tags");

-- 3. The catalog.
CREATE TABLE IF NOT EXISTS "investor_tags" (
  "id"         TEXT NOT NULL,
  "code"       TEXT NOT NULL,
  "label"      TEXT NOT NULL,
  "color"      TEXT NOT NULL DEFAULT 'grey',
  "is_system"  BOOLEAN NOT NULL DEFAULT false,
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 100,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "investor_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "investor_tags_code_key"
  ON "investor_tags" ("code");

CREATE INDEX IF NOT EXISTS "investor_tags_sort_order_idx"
  ON "investor_tags" ("sort_order");

-- 4. Seed the tag the import needs.
--
--    `is_system` is deliberately FALSE: the ask is for a working tag, not a
--    permanent fixture, and a system row cannot be deleted (only
--    deactivated). If the team abandons this outreach list they should be
--    able to remove the tag outright.
--
--    ON CONFLICT keeps a re-run harmless and, importantly, will not clobber
--    a label or colour an admin has since changed.
INSERT INTO "investor_tags" ("id", "code", "label", "color", "sort_order")
VALUES ('itag_seed_checks', 'seed-checks', 'Seed checks', 'gold', 10)
ON CONFLICT ("code") DO NOTHING;
