-- Multi-company foundation (Accounting Phase-1, PRD Rule 7).
--
-- ADDITIVE + idempotent. This migration only ADDS a membership table and a
-- nullable `active_entity_id` column on users; it does NOT touch roles,
-- user_roles, role_permissions, or any permission-resolution path. Existing
-- login + permission behaviour is unchanged. Per-entity permission ENFORCEMENT
-- is a later chunk — this stores memberships + the selected company only.
--
-- Safe to re-run after a partial-apply / P3009 incident: every statement is
-- guarded (IF NOT EXISTS / ON CONFLICT DO NOTHING / pg_constraint check).
-- Also safe on staging `db:push` (additive schema).

-- 1. Membership table. Column types mirror the referenced PKs:
--    users.id = UUID, entities.id = TEXT (cuid), roles.id = UUID.
CREATE TABLE IF NOT EXISTS "user_entity_memberships" (
    "id"         TEXT NOT NULL,
    "user_id"    UUID NOT NULL,
    "entity_id"  TEXT NOT NULL,
    "role_id"    UUID,
    "is_active"  BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_entity_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_entity_memberships_user_id_entity_id_key"
  ON "user_entity_memberships" ("user_id", "entity_id");

CREATE INDEX IF NOT EXISTS "user_entity_memberships_entity_id_idx"
  ON "user_entity_memberships" ("entity_id");

-- Foreign keys (Postgres has no ADD CONSTRAINT IF NOT EXISTS — guard on
-- pg_constraint so a rerun is a no-op).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_entity_memberships_user_id_fkey'
  ) THEN
    ALTER TABLE "user_entity_memberships"
      ADD CONSTRAINT "user_entity_memberships_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_entity_memberships_entity_id_fkey'
  ) THEN
    ALTER TABLE "user_entity_memberships"
      ADD CONSTRAINT "user_entity_memberships_entity_id_fkey"
      FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_entity_memberships_role_id_fkey'
  ) THEN
    ALTER TABLE "user_entity_memberships"
      ADD CONSTRAINT "user_entity_memberships_role_id_fkey"
      FOREIGN KEY ("role_id") REFERENCES "roles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. Selected-company pointer on users (nullable, no FK — validated in service).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active_entity_id" TEXT;

-- 3. Backfill (idempotent). Give every user with a home entity a membership
--    for it, and default their selected company to that home entity.
INSERT INTO "user_entity_memberships" ("id", "user_id", "entity_id", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid()::text, u."id", u."entity_id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users" u
WHERE u."entity_id" IS NOT NULL
ON CONFLICT ("user_id", "entity_id") DO NOTHING;

UPDATE "users"
SET "active_entity_id" = "entity_id"
WHERE "active_entity_id" IS NULL AND "entity_id" IS NOT NULL;
