-- Partner CRM task recovery.
--
-- The original 20260902000000_partner_native_workspace copy joined
-- `partners.primary_project_id = project.id` to seed `partner_tasks`
-- from `project_tasks`. That copy was a one-time snapshot; tasks the
-- Marketing team added to the still-linked Project *after* the
-- snapshot never landed in `partner_tasks`. Phase 4b then dropped
-- `partners.primary_project_id`, severing the join direction — so the
-- partner board renders empty even though the data still lives in
-- `project_*` (the surviving link is `projects.partner_id`).
--
-- This re-copies via `projects.partner_id`, but ONLY into partners
-- whose board is still empty (`NOT EXISTS … partner_tasks`). That
-- guard is critical: partners who already curated their native board
-- (added / moved / deleted tasks) must NOT have deleted tasks
-- resurrected from the stale project copy. Empty boards are pure
-- data-loss cases, so re-seeding them is safe.
--
-- Idempotent: ON CONFLICT DO NOTHING + the empty-board guard make
-- re-runs no-ops.

-- Columns: add any project columns the partner is missing. Scoped to
-- empty-board partners so we don't mutate curated boards.
INSERT INTO "partner_columns" ("id", "partner_id", "key", "label", "color", "sort_order")
SELECT pc."id", pr."partner_id", pc."key", pc."label", pc."color", pc."sort_order"
FROM   "project_columns" pc
JOIN   "projects" pr ON pr."id" = pc."project_id"
WHERE  pr."partner_id" IS NOT NULL
  AND  NOT EXISTS (
    SELECT 1 FROM "partner_tasks" t WHERE t."partner_id" = pr."partner_id"
  )
ON CONFLICT ("partner_id", "key") DO NOTHING;

-- Members.
INSERT INTO "partner_members" ("id", "partner_id", "user_id", "role", "created_at")
SELECT pm."id", pr."partner_id", pm."user_id", pm."role", pm."created_at"
FROM   "project_members" pm
JOIN   "projects" pr ON pr."id" = pm."project_id"
WHERE  pr."partner_id" IS NOT NULL
  AND  NOT EXISTS (
    SELECT 1 FROM "partner_tasks" t WHERE t."partner_id" = pr."partner_id"
  )
ON CONFLICT ("partner_id", "user_id") DO NOTHING;

-- Tasks.
INSERT INTO "partner_tasks" (
    "id", "partner_id", "parent_task_id", "title", "description",
    "status", "priority", "owner_id", "start_date", "end_date",
    "sort_order", "created_at", "updated_at"
)
SELECT pt."id", pr."partner_id", pt."parent_task_id", pt."title", pt."description",
       pt."status", pt."priority", pt."owner_id", pt."start_date", pt."end_date",
       pt."sort_order", pt."created_at", pt."updated_at"
FROM   "project_tasks" pt
JOIN   "projects" pr ON pr."id" = pt."project_id"
WHERE  pr."partner_id" IS NOT NULL
  AND  NOT EXISTS (
    SELECT 1 FROM "partner_tasks" t WHERE t."partner_id" = pr."partner_id"
  )
ON CONFLICT ("id") DO NOTHING;

-- Task comments (follow the recovered tasks).
INSERT INTO "partner_task_comments" (
    "id", "task_id", "author_id", "body", "created_at", "updated_at"
)
SELECT ptc."id", ptc."task_id", ptc."author_id", ptc."body", ptc."created_at", ptc."updated_at"
FROM   "project_task_comments" ptc
JOIN   "partner_tasks" t ON t."id" = ptc."task_id"
ON CONFLICT ("id") DO NOTHING;

-- Task assignees (follow the recovered tasks).
INSERT INTO "partner_task_assignees" (
    "id", "task_id", "user_id", "allocation_pct", "created_at"
)
SELECT pta."id", pta."task_id", pta."user_id", pta."allocation_pct", pta."created_at"
FROM   "project_task_assignees" pta
JOIN   "partner_tasks" t ON t."id" = pta."task_id"
ON CONFLICT ("task_id", "user_id") DO NOTHING;
