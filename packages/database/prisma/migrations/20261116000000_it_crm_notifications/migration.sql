-- Per-user IT CRM update-notification store (Phase 3): task status change,
-- (re)assignment, and comment events. Plain id columns (no FK) so nothing
-- cascades from User/Project. Idempotent + additive, safe on staging db:push.
CREATE TABLE IF NOT EXISTS "it_crm_notifications" (
  "id"         UUID NOT NULL,
  "user_id"    UUID NOT NULL,
  "type"       TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "body"       TEXT,
  "link_url"   TEXT,
  "project_id" TEXT,
  "task_id"    UUID,
  "actor_id"   UUID,
  "read_at"    TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "it_crm_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "it_crm_notifications_user_id_created_at_idx"
  ON "it_crm_notifications"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "it_crm_notifications_user_id_read_at_idx"
  ON "it_crm_notifications"("user_id", "read_at");
