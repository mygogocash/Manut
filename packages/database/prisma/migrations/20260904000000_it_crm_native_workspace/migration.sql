-- Phase 1 of the IT CRM standalone workspace (Option A per-CRM
-- schema isolation, 2026-05-26). Mirrors the Partner Phase 1
-- pattern (#603): adds dedicated `it_*` tables and copies the
-- existing data from `projects WHERE team='it'` plus its
-- sub-tables.
--
-- The shared `projects` rows with `team='it'` stay in place until
-- the IT CRM Phase 4 cutover retires them. Both copies coexist
-- during the transition — same playbook as Partner.
--
-- Every statement is idempotent (`IF NOT EXISTS` / `ON CONFLICT
-- DO NOTHING`) so a partial-apply incident can re-run cleanly.

-- ─── New tables ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "it_projects" (
    "id"                    TEXT         PRIMARY KEY,
    "name"                  TEXT         NOT NULL,
    "slug"                  TEXT         NOT NULL UNIQUE,
    "description"           TEXT,
    "status"                TEXT         NOT NULL DEFAULT 'not_yet_started',
    "owner_id"              UUID         NOT NULL,
    "start_date"            DATE,
    "end_date"              DATE,
    "production_live_date"  DATE,
    "go_live_date"          DATE,
    "revised_go_live_date"  DATE,
    "dependency"            TEXT,
    "comment"               TEXT,
    "sort_order"            INTEGER      NOT NULL DEFAULT 0,
    "department"            TEXT,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "it_projects_owner_id_fkey"
        FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "it_projects_sort_order_idx" ON "it_projects"("sort_order");
CREATE INDEX IF NOT EXISTS "it_projects_department_idx" ON "it_projects"("department");

CREATE TABLE IF NOT EXISTS "it_project_members" (
    "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "project_id" TEXT         NOT NULL,
    "user_id"    UUID         NOT NULL,
    "role"       TEXT         NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "it_project_members_project_id_user_id_key" UNIQUE ("project_id", "user_id"),
    CONSTRAINT "it_project_members_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "it_projects"("id") ON DELETE CASCADE,
    CONSTRAINT "it_project_members_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "it_project_columns" (
    "id"         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    "project_id" TEXT    NOT NULL,
    "key"        TEXT    NOT NULL,
    "label"      TEXT    NOT NULL,
    "color"      TEXT    NOT NULL DEFAULT 'bg-zinc-500',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "it_project_columns_project_id_key_key" UNIQUE ("project_id", "key"),
    CONSTRAINT "it_project_columns_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "it_projects"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "it_project_columns_project_id_idx" ON "it_project_columns"("project_id");

CREATE TABLE IF NOT EXISTS "it_project_tasks" (
    "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "project_id"     TEXT         NOT NULL,
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
    CONSTRAINT "it_project_tasks_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "it_projects"("id") ON DELETE CASCADE,
    CONSTRAINT "it_project_tasks_owner_id_fkey"
        FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "it_project_tasks_parent_task_id_fkey"
        FOREIGN KEY ("parent_task_id") REFERENCES "it_project_tasks"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "it_project_tasks_project_id_idx"     ON "it_project_tasks"("project_id");
CREATE INDEX IF NOT EXISTS "it_project_tasks_parent_task_id_idx" ON "it_project_tasks"("parent_task_id");

CREATE TABLE IF NOT EXISTS "it_project_task_comments" (
    "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "task_id"    UUID         NOT NULL,
    "author_id"  UUID         NOT NULL,
    "body"       TEXT         NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "it_project_task_comments_task_id_fkey"
        FOREIGN KEY ("task_id") REFERENCES "it_project_tasks"("id") ON DELETE CASCADE,
    CONSTRAINT "it_project_task_comments_author_id_fkey"
        FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "it_project_task_comments_task_id_idx"   ON "it_project_task_comments"("task_id");
CREATE INDEX IF NOT EXISTS "it_project_task_comments_author_id_idx" ON "it_project_task_comments"("author_id");

CREATE TABLE IF NOT EXISTS "it_project_task_assignees" (
    "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "task_id"        UUID         NOT NULL,
    "user_id"        UUID         NOT NULL,
    "allocation_pct" INTEGER,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "it_project_task_assignees_task_id_user_id_key" UNIQUE ("task_id", "user_id"),
    CONSTRAINT "it_project_task_assignees_task_id_fkey"
        FOREIGN KEY ("task_id") REFERENCES "it_project_tasks"("id") ON DELETE CASCADE,
    CONSTRAINT "it_project_task_assignees_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "it_project_task_assignees_user_id_idx" ON "it_project_task_assignees"("user_id");

-- ─── Data copy ──────────────────────────────────────────────────
--
-- Source: every row in the shared `projects` graph where
-- `team='it'`, plus its members / columns / tasks / comments /
-- assignees. `ON CONFLICT DO NOTHING` makes the copy re-runnable.

INSERT INTO "it_projects" (
    "id", "name", "slug", "description", "status", "owner_id",
    "start_date", "end_date", "production_live_date", "go_live_date",
    "revised_go_live_date", "dependency", "comment", "sort_order",
    "department", "created_at", "updated_at"
)
SELECT "id", "name", "slug", "description", "status", "owner_id",
       "start_date", "end_date", "production_live_date", "go_live_date",
       "revised_go_live_date", "dependency", "comment", "sort_order",
       "department", "created_at", "updated_at"
FROM   "projects"
WHERE  "team" = 'it'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "it_project_columns" (
    "id", "project_id", "key", "label", "color", "sort_order"
)
SELECT pc."id", pc."project_id", pc."key", pc."label", pc."color", pc."sort_order"
FROM   "project_columns" pc
JOIN   "projects"        p ON p."id" = pc."project_id"
WHERE  p."team" = 'it'
ON CONFLICT ("project_id", "key") DO NOTHING;

INSERT INTO "it_project_members" (
    "id", "project_id", "user_id", "role", "created_at"
)
SELECT pm."id", pm."project_id", pm."user_id", pm."role", pm."created_at"
FROM   "project_members" pm
JOIN   "projects"        p ON p."id" = pm."project_id"
WHERE  p."team" = 'it'
ON CONFLICT ("project_id", "user_id") DO NOTHING;

INSERT INTO "it_project_tasks" (
    "id", "project_id", "parent_task_id", "title", "description",
    "status", "priority", "owner_id", "start_date", "end_date",
    "sort_order", "created_at", "updated_at"
)
SELECT pt."id", pt."project_id", pt."parent_task_id", pt."title", pt."description",
       pt."status", pt."priority", pt."owner_id", pt."start_date", pt."end_date",
       pt."sort_order", pt."created_at", pt."updated_at"
FROM   "project_tasks" pt
JOIN   "projects"      p ON p."id" = pt."project_id"
WHERE  p."team" = 'it'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "it_project_task_comments" (
    "id", "task_id", "author_id", "body", "created_at", "updated_at"
)
SELECT ptc."id", ptc."task_id", ptc."author_id", ptc."body", ptc."created_at", ptc."updated_at"
FROM   "project_task_comments" ptc
JOIN   "project_tasks"         pt ON pt."id" = ptc."task_id"
JOIN   "projects"              p  ON p."id" = pt."project_id"
WHERE  p."team" = 'it'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "it_project_task_assignees" (
    "id", "task_id", "user_id", "allocation_pct", "created_at"
)
SELECT pta."id", pta."task_id", pta."user_id", pta."allocation_pct", pta."created_at"
FROM   "project_task_assignees" pta
JOIN   "project_tasks"          pt ON pt."id" = pta."task_id"
JOIN   "projects"               p  ON p."id" = pt."project_id"
WHERE  p."team" = 'it'
ON CONFLICT ("task_id", "user_id") DO NOTHING;
