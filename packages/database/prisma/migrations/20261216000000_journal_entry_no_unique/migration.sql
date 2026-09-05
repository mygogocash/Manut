-- Journal entry numbering: one race-safe counter, then a uniqueness guarantee.
--
-- THE BUG. Two independent counters emitted the same "JE-" + 6-digit format:
--   * the manual path used COUNT(*)+1 (accounting.repository.generateEntryNo)
--   * the posting engine uses allocateDocumentNumber(entityId, "je")
-- and journal_entries had no unique constraint on (entity_id, entry_no). The
-- manual counter also hands the same number to two concurrent creators.
--
-- ACCOUNTING_GL_POSTING is still false, which is the only reason this has not
-- fired: the "je" sequence has never been allocated, so it would start at 1 and
-- collide with every existing JE-000001..N the moment the flag is switched on.
--
-- The code change points the manual path at allocateDocumentNumber. This
-- migration makes the existing data safe for it, in three ordered steps.

-- 1. De-duplicate existing entry numbers per entity. The oldest row keeps the
--    number; later collisions get a "-D<n>" suffix so the original is still
--    recognisable in an audit trail. Untouched when there are no duplicates.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY entity_id, entry_no
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM journal_entries
)
UPDATE journal_entries je
SET entry_no = je.entry_no || '-D' || ranked.rn
FROM ranked
WHERE je.id = ranked.id
  AND ranked.rn > 1;

-- 2. Seed the "je" DocumentSequence per entity to one past the highest number
--    already in use. WITHOUT THIS the allocator starts at 1 on first use and
--    reissues numbers that already exist — the exact failure the unique index
--    below would then surface as a hard error on a user's save.
--
--    Only the plain "JE-<digits>" form is considered; a de-duplicated
--    "JE-000004-D2" contributes its base number, which the regexp already
--    captured from the leading digits.
INSERT INTO document_sequences (
  id, entity_id, doc_type, prefix, pad_width, reset_period, period_key,
  next_number, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  m.entity_id,
  'je',
  'JE-',
  6,
  'none',
  'none',
  m.max_no + 1,
  NOW(),
  NOW()
FROM (
  SELECT
    entity_id,
    COALESCE(MAX((substring(entry_no FROM '^JE-(\d+)'))::bigint), 0) AS max_no
  FROM journal_entries
  WHERE entry_no ~ '^JE-\d+'
  GROUP BY entity_id
) m
WHERE NOT EXISTS (
  SELECT 1 FROM document_sequences ds
  WHERE ds.entity_id = m.entity_id
    AND ds.doc_type = 'je'
    AND ds.period_key = 'none'
);

-- 3. Constrain it, so a future regression fails loudly instead of silently
--    issuing a duplicate number to a posted journal entry.
CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_entity_id_entry_no_key"
  ON "journal_entries" ("entity_id", "entry_no");
