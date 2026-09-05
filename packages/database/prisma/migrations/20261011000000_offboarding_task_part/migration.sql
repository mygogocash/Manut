-- Offboarding tasks: migrate the fixed `section` enum ("asset"/"access")
-- to a free-form `part` label so HR can define their own parts. Maps the
-- two original sections to their part names and drops the `section` key.
--
-- Idempotent: only rewrites rows whose tasks JSON still contains a
-- `section` key, so a re-run (or rows already on `part`) is left alone.
-- Task order is preserved via WITH ORDINALITY.

UPDATE "offboarding_runs" AS o
SET "tasks" = sub.new_tasks
FROM (
  SELECT
    r.id,
    jsonb_agg(
      (elem - 'section') || jsonb_build_object(
        'part',
        CASE elem->>'section'
          WHEN 'asset'  THEN 'Company Assets (Return)'
          WHEN 'access' THEN 'System Access (Deactivate)'
          ELSE 'General'
        END
      )
      ORDER BY ord
    ) AS new_tasks
  FROM "offboarding_runs" r,
       jsonb_array_elements(r."tasks") WITH ORDINALITY AS t(elem, ord)
  WHERE jsonb_typeof(r."tasks") = 'array'
  GROUP BY r.id
) AS sub
WHERE o.id = sub.id
  AND o."tasks"::text LIKE '%"section"%';
