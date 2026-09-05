-- Phase 1 of the QA CRM standalone workspace (Option A per-CRM
-- schema isolation, 2026-05-26). Same template as IT CRM Phase 1
-- (#609) but no data copy — QA CRM is greenfield. The Task model
-- extends with the QA team's Excel template fields: issue_date,
-- product, issue_type, observation, expectation, eta, qa_comment.
--
-- Priority enum at the application layer: P0|P1|P2.
-- Status enum mirrors the seeded default columns: open|clarified|
-- exception|closed.
--
-- Every statement is idempotent (`IF NOT EXISTS`) so a partial-apply
-- incident can re-run cleanly.

-- ─── New tables ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "qa_projects" (
    "id"          TEXT         PRIMARY KEY,
    "name"        TEXT         NOT NULL,
    "slug"        TEXT         NOT NULL UNIQUE,
    "description" TEXT,
    "status"      TEXT         NOT NULL DEFAULT 'active',
    "owner_id"    UUID         NOT NULL,
    "start_date"  DATE,
    "end_date"    DATE,
    "comment"     TEXT,
    "sort_order"  INTEGER      NOT NULL DEFAULT 0,
    "department"  TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qa_projects_owner_id_fkey"
        FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "qa_projects_sort_order_idx" ON "qa_projects"("sort_order");
CREATE INDEX IF NOT EXISTS "qa_projects_department_idx" ON "qa_projects"("department");

CREATE TABLE IF NOT EXISTS "qa_project_members" (
    "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "project_id" TEXT         NOT NULL,
    "user_id"    UUID         NOT NULL,
    "role"       TEXT         NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qa_project_members_project_id_user_id_key" UNIQUE ("project_id", "user_id"),
    CONSTRAINT "qa_project_members_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "qa_projects"("id") ON DELETE CASCADE,
    CONSTRAINT "qa_project_members_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "qa_project_columns" (
    "id"         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    "project_id" TEXT    NOT NULL,
    "key"        TEXT    NOT NULL,
    "label"      TEXT    NOT NULL,
    "color"      TEXT    NOT NULL DEFAULT 'bg-zinc-500',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "qa_project_columns_project_id_key_key" UNIQUE ("project_id", "key"),
    CONSTRAINT "qa_project_columns_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "qa_projects"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "qa_project_columns_project_id_idx" ON "qa_project_columns"("project_id");

CREATE TABLE IF NOT EXISTS "qa_project_tasks" (
    "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "project_id"     TEXT         NOT NULL,
    "parent_task_id" UUID,
    "title"          TEXT         NOT NULL,
    "description"    TEXT,
    "status"         TEXT         NOT NULL DEFAULT 'open',
    "priority"       TEXT         NOT NULL DEFAULT 'P1',
    "owner_id"       UUID,
    "start_date"     DATE,
    "end_date"       DATE,
    "sort_order"     INTEGER      NOT NULL DEFAULT 0,
    -- QA template fields (Excel: Date / Product / Issue type /
    -- Observation / Expectation / ETA / Comment).
    "issue_date"     DATE,
    "product"        TEXT,
    "issue_type"     TEXT,
    "observation"    TEXT,
    "expectation"    TEXT,
    "eta"            TEXT,
    "qa_comment"     TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qa_project_tasks_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "qa_projects"("id") ON DELETE CASCADE,
    CONSTRAINT "qa_project_tasks_owner_id_fkey"
        FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "qa_project_tasks_parent_task_id_fkey"
        FOREIGN KEY ("parent_task_id") REFERENCES "qa_project_tasks"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "qa_project_tasks_project_id_idx"     ON "qa_project_tasks"("project_id");
CREATE INDEX IF NOT EXISTS "qa_project_tasks_parent_task_id_idx" ON "qa_project_tasks"("parent_task_id");
CREATE INDEX IF NOT EXISTS "qa_project_tasks_product_idx"        ON "qa_project_tasks"("product");
CREATE INDEX IF NOT EXISTS "qa_project_tasks_priority_idx"       ON "qa_project_tasks"("priority");
CREATE INDEX IF NOT EXISTS "qa_project_tasks_status_idx"         ON "qa_project_tasks"("status");

CREATE TABLE IF NOT EXISTS "qa_project_task_comments" (
    "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "task_id"    UUID         NOT NULL,
    "author_id"  UUID         NOT NULL,
    "body"       TEXT         NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qa_project_task_comments_task_id_fkey"
        FOREIGN KEY ("task_id") REFERENCES "qa_project_tasks"("id") ON DELETE CASCADE,
    CONSTRAINT "qa_project_task_comments_author_id_fkey"
        FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "qa_project_task_comments_task_id_idx"   ON "qa_project_task_comments"("task_id");
CREATE INDEX IF NOT EXISTS "qa_project_task_comments_author_id_idx" ON "qa_project_task_comments"("author_id");

CREATE TABLE IF NOT EXISTS "qa_project_task_assignees" (
    "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "task_id"        UUID         NOT NULL,
    "user_id"        UUID         NOT NULL,
    "allocation_pct" INTEGER,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qa_project_task_assignees_task_id_user_id_key" UNIQUE ("task_id", "user_id"),
    CONSTRAINT "qa_project_task_assignees_task_id_fkey"
        FOREIGN KEY ("task_id") REFERENCES "qa_project_tasks"("id") ON DELETE CASCADE,
    CONSTRAINT "qa_project_task_assignees_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "qa_project_task_assignees_user_id_idx" ON "qa_project_task_assignees"("user_id");
