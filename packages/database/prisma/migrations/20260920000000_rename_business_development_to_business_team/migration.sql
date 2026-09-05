-- Rename department label "Business Development" → "Business Team"
-- across every table that stores it as plain text. Code-side
-- whitelists were updated in the same PR; this migration brings the
-- already-persisted rows along so the dropdown keeps recognising
-- existing employees / projects / partners.
--
-- Scoped to `department` + `department_snapshot` columns under the
-- `public` schema. The master `departments` table is updated by
-- explicit name match below.

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('department', 'department_snapshot')
      AND data_type IN ('text', 'character varying')
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = %L WHERE %I = %L',
      rec.table_schema,
      rec.table_name,
      rec.column_name,
      'Business Team',
      rec.column_name,
      'Business Development'
    );
  END LOOP;
END $$;

UPDATE "departments"
SET "name" = 'Business Team'
WHERE "name" = 'Business Development';
