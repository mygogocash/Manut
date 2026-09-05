-- ARIA knowledge corpus — vector retrieval upgrade.
-- v1 used keyword overlap; v2 swaps in cosine similarity over Gemini
-- text-embedding-004 vectors (768 dims). Existing rows keep working
-- through a keyword fallback until they're back-filled by the
-- `/aria/knowledge/reindex` admin endpoint or by the next edit save.
-- Idempotent: safe to re-run.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "aria_knowledge_articles"
  ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- IVFFlat index sized for tiny corpora; lists=1 is fine for <100 rows
-- and keeps inserts cheap. Bumps the list count later if the corpus
-- grows past a few thousand rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'aria_knowledge_articles_embedding_idx'
  ) THEN
    EXECUTE 'CREATE INDEX "aria_knowledge_articles_embedding_idx"
             ON "aria_knowledge_articles"
             USING ivfflat ("embedding" vector_cosine_ops)
             WITH (lists = 1)';
  END IF;
END$$;
