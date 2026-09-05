-- ARIA Phase 6 — self-improvement loop.
--
-- Persisted thumbs feedback on assistant messages. One row per
-- (message_id, user_id) — a user revising their rating overwrites
-- the same row, no double-count in the improvement queue.
--
-- `reviewed` flips when an admin clears the row from the queue
-- (drafted an article from it, or dismissed). `resulting_article_id`
-- closes the loop so we can later report on how often the article
-- the feedback drove gets retrieved.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS "aria_feedback" (
  "id"                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id"            UUID         NOT NULL,
  "user_id"               UUID         NOT NULL,
  "rating"                TEXT         NOT NULL,
  "reason"                VARCHAR(1000) NULL,
  "reviewed"              BOOLEAN      NOT NULL DEFAULT FALSE,
  "reviewed_by_id"        UUID         NULL,
  "reviewed_at"           TIMESTAMP(3) NULL,
  "review_note"           VARCHAR(500) NULL,
  "resulting_article_id"  UUID         NULL,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "aria_feedback_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "aria_messages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "aria_feedback_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "aria_feedback_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "aria_feedback_resulting_article_id_fkey"
    FOREIGN KEY ("resulting_article_id") REFERENCES "aria_knowledge_articles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "aria_feedback_message_id_user_id_key"
  ON "aria_feedback" ("message_id", "user_id");
CREATE INDEX IF NOT EXISTS "aria_feedback_rating_reviewed_created_at_idx"
  ON "aria_feedback" ("rating", "reviewed", "created_at");
CREATE INDEX IF NOT EXISTS "aria_feedback_reviewed_by_id_idx"
  ON "aria_feedback" ("reviewed_by_id");
