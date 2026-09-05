-- Onboarding tasks: add a free-form `part` to each task so HR can group
-- the checklist into sections (mirrors offboarding). Existing tasks were
-- flat — bucket them under a single default part.
--
-- Idempotent: only rewrites rows that have at least one task missing a
-- `part` key; tasks already carrying `part` are left untouched. Order is
-- preserved via WITH ORDINALITY.

UPDATE "onboarding_runs" AS o
SET "tasks" = sub.new_tasks
FROM (
  SELECT
    r.id,
    jsonb_agg(
      CASE
        WHEN elem ? 'part' THEN elem
        ELSE elem || jsonb_build_object('part', 'Onboarding Checklist')
      END
      ORDER BY ord
    ) AS new_tasks
  FROM "onboarding_runs" r,
       jsonb_array_elements(r."tasks") WITH ORDINALITY AS t(elem, ord)
  WHERE jsonb_typeof(r."tasks") = 'array'
  GROUP BY r.id
) AS sub
WHERE o.id = sub.id
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(o."tasks") e
    WHERE NOT (e ? 'part')
  );
