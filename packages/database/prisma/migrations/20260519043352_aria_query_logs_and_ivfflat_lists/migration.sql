-- ARIA observability — Phase 1.
--
-- 1. `aria_query_logs` captures per-turn telemetry so the admin
--    insights page can compute hit-rate, latency percentiles, and
--    surface "empty-retrieval" queries that need new knowledge
--    articles. Best-effort writes — see `aria.service.chatStream`.
-- 2. Rebuild the IVFFlat index with `lists = 10`. The original
--    `lists = 1` was sized for the seed (<100 rows); recall degrades
--    quickly as the corpus grows. Cost of a rebuild on a small index
--    is negligible.
-- Idempotent: every statement guards on EXISTS / IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "aria_query_logs" (
  "id"                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id"        UUID         NULL,
  "user_id"                UUID         NOT NULL,
  "user_message"           TEXT         NOT NULL,
  "retrieved_article_ids"  UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[],
  "retrieved_distances"    DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
  "top_distance"           DOUBLE PRECISION NULL,
  "retrieval_mode"         TEXT         NOT NULL DEFAULT 'vector',
  "workspace_bytes"        INTEGER      NOT NULL DEFAULT 0,
  "knowledge_bytes"        INTEGER      NOT NULL DEFAULT 0,
  "latency_ms"             INTEGER      NOT NULL,
  "tokens_in"              INTEGER      NULL,
  "tokens_out"             INTEGER      NULL,
  "cache_read_tokens"      INTEGER      NULL,
  "cache_create_tokens"    INTEGER      NULL,
  "model"                  TEXT         NOT NULL,
  "error"                  BOOLEAN      NOT NULL DEFAULT FALSE,
  "error_message"          TEXT         NULL,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "aria_query_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "aria_query_logs_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "aria_conversations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "aria_query_logs_created_at_idx"
  ON "aria_query_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "aria_query_logs_user_id_created_at_idx"
  ON "aria_query_logs" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "aria_query_logs_conversation_id_idx"
  ON "aria_query_logs" ("conversation_id");

-- Rebuild the IVFFlat index with a larger list count. DROP + CREATE is
-- required because IVFFlat's `lists` is a build-time parameter.
DROP INDEX IF EXISTS "aria_knowledge_articles_embedding_idx";
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'aria_knowledge_articles'
       AND column_name = 'embedding'
  ) THEN
    EXECUTE 'CREATE INDEX "aria_knowledge_articles_embedding_idx"
             ON "aria_knowledge_articles"
             USING ivfflat ("embedding" vector_cosine_ops)
             WITH (lists = 10)';
  END IF;
END$$;
