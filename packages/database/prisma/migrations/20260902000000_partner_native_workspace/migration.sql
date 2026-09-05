-- Phase 1 of the Partner ↔ Project decouple (Marketing incident,
-- Darpan, 2026-05-26).
--
-- Adds Partner-native task tables and copies the existing data
-- from the Project graph for every Partner-backed project (i.e.
-- every project that has a row in `partners.primary_project_id`).
-- The Project rows stay in place — the redirect-shim from #576
-- still points at them during the transition. Phase 2+ migrates
-- the UI off the redirect, then a follow-up drops the legacy
-- columns.
--
-- Every statement is idempotent (`IF NOT EXISTS` / `ON CONFLICT
-- DO NOTHING`) so a partial-apply incident can re-run cleanly.

-- ─── New tables ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "partner_members" (
    "id"          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "partner_id"  TEXT         NOT NULL,
    "user_id"     UUID         NOT NULL,
    "role"        TEXT         NOT NULL DEFAULT 'member',
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_members_partner_id_user_id_key" UNIQUE ("partner_id", "user_id"),
    CONSTRAINT "partner_members_partner_id_fkey"
        FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE,
    CONSTRAINT "partner_members_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "partner_columns" (
    "id"         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    "partner_id" TEXT    NOT NULL,
    "key"        TEXT    NOT NULL,
    "label"      TEXT    NOT NULL,
    "color"      TEXT    NOT NULL DEFAULT 'bg-zinc-500',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "partner_columns_partner_id_key_key" UNIQUE ("partner_id", "key"),
    CONSTRAINT "partner_columns_partner_id_fkey"
        FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "partner_columns_partner_id_idx" ON "partner_columns"("partner_id");

CREATE TABLE IF NOT EXISTS "partner_tasks" (
    "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "partner_id"     TEXT         NOT NULL,
    "parent_task_id" UUID,
    "title"          TEXT         NOT NULL,
    "description"    TEXT,
    "status"         TEXT         NOT NULL DEFAULT 'todo',
    "priority"       TEXT         NOT NULL DEFAULT 'medium',
    "owner_id"       UUID,
    "start_date"     DATE,
    "end_date"       DATE,
    "sort_order"     INTEGER      NOT NULL DEFAULT 0,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_tasks_partner_id_fkey"
        FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE,
    CONSTRAINT "partner_tasks_owner_id_fkey"
        FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "partner_tasks_parent_task_id_fkey"
        FOREIGN KEY ("parent_task_id") REFERENCES "partner_tasks"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "partner_tasks_partner_id_idx"     ON "partner_tasks"("partner_id");
CREATE INDEX IF NOT EXISTS "partner_tasks_parent_task_id_idx" ON "partner_tasks"("parent_task_id");

CREATE TABLE IF NOT EXISTS "partner_task_comments" (
    "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "task_id"    UUID         NOT NULL,
    "author_id"  UUID         NOT NULL,
    "body"       TEXT         NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_task_comments_task_id_fkey"
        FOREIGN KEY ("task_id") REFERENCES "partner_tasks"("id") ON DELETE CASCADE,
    CONSTRAINT "partner_task_comments_author_id_fkey"
        FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "partner_task_comments_task_id_idx"   ON "partner_task_comments"("task_id");
CREATE INDEX IF NOT EXISTS "partner_task_comments_author_id_idx" ON "partner_task_comments"("author_id");

CREATE TABLE IF NOT EXISTS "partner_task_assignees" (
    "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "task_id"        UUID         NOT NULL,
    "user_id"        UUID         NOT NULL,
    "allocation_pct" INTEGER,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_task_assignees_task_id_user_id_key" UNIQUE ("task_id", "user_id"),
    CONSTRAINT "partner_task_assignees_task_id_fkey"
        FOREIGN KEY ("task_id") REFERENCES "partner_tasks"("id") ON DELETE CASCADE,
    CONSTRAINT "partner_task_assignees_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "partner_task_assignees_user_id_idx" ON "partner_task_assignees"("user_id");

-- ─── Data copy ──────────────────────────────────────────────────
--
-- Source: project_* rows whose `project_id` is referenced by some
-- `partners.primary_project_id`. We resolve the partner via that
-- FK so the copy preserves the existing 1:1 relationship.
--
-- ON CONFLICT DO NOTHING makes the copy re-runnable. A subsequent
-- deploy (e.g. after manual data fixes) won't duplicate rows.

INSERT INTO "partner_columns" ("id", "partner_id", "key", "label", "color", "sort_order")
SELECT pc."id",
       p."id"          AS partner_id,
       pc."key",
       pc."label",
       pc."color",
       pc."sort_order"
FROM   "project_columns" pc
JOIN   "partners"        p ON p."primary_project_id" = pc."project_id"
ON CONFLICT ("partner_id", "key") DO NOTHING;

INSERT INTO "partner_members" ("id", "partner_id", "user_id", "role", "created_at")
SELECT pm."id",
       p."id" AS partner_id,
       pm."user_id",
       pm."role",
       pm."created_at"
FROM   "project_members" pm
JOIN   "partners"        p ON p."primary_project_id" = pm."project_id"
ON CONFLICT ("partner_id", "user_id") DO NOTHING;

INSERT INTO "partner_tasks" (
    "id", "partner_id", "parent_task_id", "title", "description",
    "status", "priority", "owner_id", "start_date", "end_date",
    "sort_order", "created_at", "updated_at"
)
SELECT pt."id",
       p."id" AS partner_id,
       pt."parent_task_id",
       pt."title",
       pt."description",
       pt."status",
       pt."priority",
       pt."owner_id",
       pt."start_date",
       pt."end_date",
       pt."sort_order",
       pt."created_at",
       pt."updated_at"
FROM   "project_tasks" pt
JOIN   "partners"      p ON p."primary_project_id" = pt."project_id"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "partner_task_comments" (
    "id", "task_id", "author_id", "body", "created_at", "updated_at"
)
SELECT ptc."id",
       ptc."task_id",
       ptc."author_id",
       ptc."body",
       ptc."created_at",
       ptc."updated_at"
FROM   "project_task_comments" ptc
JOIN   "project_tasks"         pt ON pt."id" = ptc."task_id"
JOIN   "partners"              p  ON p."primary_project_id" = pt."project_id"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "partner_task_assignees" (
    "id", "task_id", "user_id", "allocation_pct", "created_at"
)
SELECT pta."id",
       pta."task_id",
       pta."user_id",
       pta."allocation_pct",
       pta."created_at"
FROM   "project_task_assignees" pta
JOIN   "project_tasks"          pt ON pt."id" = pta."task_id"
JOIN   "partners"               p  ON p."primary_project_id" = pt."project_id"
ON CONFLICT ("task_id", "user_id") DO NOTHING;
