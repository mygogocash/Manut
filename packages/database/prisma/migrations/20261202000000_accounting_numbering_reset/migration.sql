-- Document-numbering monthly/annual reset support (Accounting Foundation, Rule 5).
--
-- Additive + idempotent. Existing rows carry reset_period='none' and
-- period_key='' (both column defaults apply on ADD COLUMN), so the counter
-- keeps behaving exactly as the previous per-(entity, doc_type) sequence until
-- a doc type is explicitly configured to reset monthly/annually.

-- reset_period ∈ none | monthly | annual — how the counter buckets by period.
ALTER TABLE "document_sequences"
  ADD COLUMN IF NOT EXISTS "reset_period" TEXT NOT NULL DEFAULT 'none';

-- period_key — the concrete period bucket ("" | "YYYYMM" | "YYYY"). NOT NULL
-- DEFAULT '' so pre-existing rows adopt the constant empty bucket and their
-- running numbers continue uninterrupted.
ALTER TABLE "document_sequences"
  ADD COLUMN IF NOT EXISTS "period_key" TEXT NOT NULL DEFAULT '';

-- Widen the uniqueness from (entity, doc_type) to (entity, doc_type, period_key)
-- so a reset period can hold an independent counter per bucket. Dropping the old
-- unique first, then creating the new one; both guarded IF (NOT) EXISTS so the
-- migration is safe to re-run after a partial apply.
DROP INDEX IF EXISTS "document_sequences_entity_id_doc_type_key";

CREATE UNIQUE INDEX IF NOT EXISTS "document_sequences_entity_id_doc_type_period_key_key"
  ON "document_sequences" ("entity_id", "doc_type", "period_key");
