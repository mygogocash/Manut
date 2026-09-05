-- Scope leave types to an entity. Existing rows stay global
-- (entity_id NULL) so they keep applying to everyone until HR
-- explicitly assigns them.

ALTER TABLE "leave_types"
  ADD COLUMN IF NOT EXISTS "entity_id" TEXT;

-- The old `name` and `code` global-unique constraints would block
-- having "Annual Leave" / "AL" in TBH Thailand and TBH India at the
-- same time.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_types_name_key'
  ) THEN
    EXECUTE 'ALTER TABLE "leave_types" DROP CONSTRAINT "leave_types_name_key"';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_types_code_key'
  ) THEN
    EXECUTE 'ALTER TABLE "leave_types" DROP CONSTRAINT "leave_types_code_key"';
  END IF;
END $$;

DROP INDEX IF EXISTS "leave_types_name_key";
DROP INDEX IF EXISTS "leave_types_code_key";

-- New composite uniques: same name/code can repeat across entities,
-- but cannot collide within one entity (or within the global pool).
CREATE UNIQUE INDEX IF NOT EXISTS "leave_types_entity_id_code_key"
  ON "leave_types" ("entity_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "leave_types_entity_id_name_key"
  ON "leave_types" ("entity_id", "name");
CREATE INDEX IF NOT EXISTS "leave_types_entity_id_is_active_idx"
  ON "leave_types" ("entity_id", "is_active");

ALTER TABLE "leave_types"
  ADD CONSTRAINT "leave_types_entity_id_fkey"
  FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
