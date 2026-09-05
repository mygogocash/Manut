-- TBH Thailand 2026 public holiday calendar (HR announcement). The
-- Thailand entity is seeded with a cuid via the prisma seed, so look it
-- up by its `code = 'TH'` at run time. ON CONFLICT DO NOTHING keeps
-- this migration idempotent if HR re-uploads.

INSERT INTO "public_holidays" ("entity_id", "date", "name")
SELECT e.id, v.date::date, v.name
FROM "entities" e
CROSS JOIN (VALUES
  ('2026-01-01', 'New Year''s Day'),
  ('2026-03-03', 'Makha Bucha'),
  ('2026-04-13', 'Songkran Festival'),
  ('2026-04-14', 'Songkran Festival'),
  ('2026-05-01', 'National Labour Day'),
  ('2026-05-04', 'Coronation Day'),
  ('2026-06-03', 'H.M. Queen''s Birthday'),
  ('2026-07-28', 'H.M. King''s Birthday'),
  ('2026-08-12', 'Mother''s Day'),
  ('2026-10-13', 'H.M. King Bhumibol Adulyadej the Great Memorial Day'),
  ('2026-10-23', 'Chulalongkorn Day'),
  ('2026-12-07', 'Substitution for Father''s Day'),
  ('2026-12-31', 'New Year''s Eve')
) AS v(date, name)
WHERE e.code = 'TH'
ON CONFLICT ("entity_id", "date") DO NOTHING;
