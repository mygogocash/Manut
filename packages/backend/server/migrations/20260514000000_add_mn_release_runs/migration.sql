-- Manut Control Plane Phase 4: immutable Release Run + Task board.
--
-- Tables seed from the handover JSON payload produced by
-- scripts/manut-release-handover.mjs and ingested via
-- importSuperflowHandover. The board renders these rows alongside
-- the existing handover doc; the doc remains the source of truth for
-- humans, the rows make the board queryable.
--
-- Idempotency is enforced by UNIQUE(workspace_id, gh_run_id) so a
-- re-import of the same JSON updates the run in place rather than
-- duplicating it.

CREATE TABLE "mn_release_runs" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "gh_run_id" VARCHAR NOT NULL,
    "gh_run_url" TEXT,
    "mode" VARCHAR NOT NULL,
    "status" VARCHAR NOT NULL,
    "version" VARCHAR,
    "short_sha" VARCHAR,
    "head_sha" VARCHAR,
    "image_tag" VARCHAR,
    "image_digest" VARCHAR,
    "registry" TEXT,
    "deploy_url" TEXT,
    "actor" VARCHAR,
    "generated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mn_release_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mn_release_tasks" (
    "id" VARCHAR NOT NULL,
    "run_id" VARCHAR NOT NULL,
    "slug" VARCHAR NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "mn_release_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mn_release_runs_workspace_id_gh_run_id_key"
    ON "mn_release_runs" ("workspace_id", "gh_run_id");

CREATE INDEX "mn_release_runs_workspace_id_generated_at_idx"
    ON "mn_release_runs" ("workspace_id", "generated_at");

CREATE INDEX "mn_release_runs_workspace_id_created_at_idx"
    ON "mn_release_runs" ("workspace_id", "created_at");

CREATE UNIQUE INDEX "mn_release_tasks_run_id_slug_key"
    ON "mn_release_tasks" ("run_id", "slug");

CREATE INDEX "mn_release_tasks_run_id_sort_order_idx"
    ON "mn_release_tasks" ("run_id", "sort_order");

ALTER TABLE "mn_release_runs"
    ADD CONSTRAINT "mn_release_runs_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mn_release_tasks"
    ADD CONSTRAINT "mn_release_tasks_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "mn_release_runs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
