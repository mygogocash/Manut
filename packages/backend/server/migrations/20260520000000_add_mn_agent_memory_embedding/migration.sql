-- Manut Wave 4 (M5b) — Memory MVP embedding columns + index.
--
-- Idempotent on purpose: re-applying this migration MUST be safe so
-- partial-run / replay scenarios don't leave the column or index missing.
-- See CLAUDE.md §1 "Honesty Rules" / R0 — untested migrations on a critical
-- path are automatically R0; the `IF NOT EXISTS` guards turn this into a
-- single-step replayable change. See also docs/IMPLEMENTATION_PLAN.md §A3
-- + Epic E1.5 (Memory MVP).
--
-- Columns added to the existing `mn_agent_memories` table:
--   embedding vector(1024) — pgvector column for kNN retrieval. Dim matches
--                            the canonical EMBEDDING_DIMENSIONS used by the
--                            rest of the copilot stack (gemini-embedding-001
--                            via the Vertex AI publisher; the same dim is
--                            used by ai_context_embeddings / ai_workspace_
--                            embeddings). The Prisma schema currently models
--                            this as `Float[] @default([])` — keep it that
--                            way to avoid introducing pgvector as a Prisma
--                            client type just yet; the new column shadows
--                            the legacy Float[] for kNN purposes via raw
--                            SQL in retrieve.service.ts.
--   scope varchar('user'|'workspace')
--                            controls cross-user visibility:
--                              user      → only the original creator can
--                                          retrieve this memory in chat.
--                              workspace → any user with workspace access
--                                          can retrieve.
--   pinned boolean           reserved for future surfacing of "must-include"
--                            memories at the top of the prompt (auto-router
--                            currently treats it as a sort key tiebreaker).
--   user_id varchar nullable
--                            owner of `user`-scoped memories. Workspace-scope
--                            memories leave this NULL so any workspace member
--                            can retrieve them. Nullable so existing rows
--                            (pre-Wave 4) don't trip a NOT NULL constraint —
--                            their `scope` defaults to 'user' but they have
--                            no owner so retrieval ignores them (the kNN
--                            query filters on `user_id = $userId`).
--
-- Index:
--   ivfflat on `embedding` with cosine ops. Same pattern as the existing
--   ai_workspace_embeddings_idx — pgvector recommends `hnsw` for newer
--   installs, but ivfflat lets the index build on an empty table without
--   the lists parameter tuning step. Re-evaluate post-launch once we have
--   real recall volume.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "mn_agent_memories"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1024);

ALTER TABLE "mn_agent_memories"
  ADD COLUMN IF NOT EXISTS "scope" varchar NOT NULL DEFAULT 'user';

ALTER TABLE "mn_agent_memories"
  ADD COLUMN IF NOT EXISTS "pinned" boolean NOT NULL DEFAULT false;

ALTER TABLE "mn_agent_memories"
  ADD COLUMN IF NOT EXISTS "user_id" varchar;

CREATE INDEX IF NOT EXISTS "mn_agent_memories_embedding_idx"
  ON "mn_agent_memories" USING ivfflat ("embedding" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "mn_agent_memories_workspace_user_scope_idx"
  ON "mn_agent_memories" ("workspace_id", "scope", "user_id");
