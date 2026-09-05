-- Travel approval steps gain submitter-conditional routing so admins
-- can carve out exceptions without extra rows. Both columns are JSON
-- arrays of User ids:
--
--   skip_when_submitter_ids  → step is skipped entirely if the
--     submitter is in this list (e.g. don't ask Sid to approve his
--     own request).
--   only_when_submitter_ids  → when non-empty, the step only fires
--     for these submitters (e.g. "CEO approval" only when Sid is
--     the submitter).
--
-- Defaults to `[]` so existing chains keep their current behaviour.

ALTER TABLE "travel_approval_steps"
  ADD COLUMN IF NOT EXISTS "skip_when_submitter_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "only_when_submitter_ids" JSONB NOT NULL DEFAULT '[]'::jsonb;
