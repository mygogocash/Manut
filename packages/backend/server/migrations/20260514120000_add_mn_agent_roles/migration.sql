-- Manut Agent Registry (Phase 3 of the Control Plane).
--
-- The 5 canonical operating roles (Release Captain, Builder, Verifier,
-- Deployer, Historian) get a row per workspace via
-- MnAgentRegistryService.seedDefaults(). The slug is the stable identifier
-- and must be unique per workspace; displayName / adapter / escalation are
-- operator-editable.
--
-- Forward-only. Rollback: DROP TABLE "mn_agent_roles"; (R0 — only safe if
-- no automation has stamped lastSuccessfulRunId values worth preserving).

CREATE TABLE "mn_agent_roles" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "slug" VARCHAR NOT NULL,
    "display_name" VARCHAR NOT NULL,
    "adapter" TEXT NOT NULL,
    "responsibility" TEXT NOT NULL,
    "escalation" TEXT,
    "last_successful_run_id" VARCHAR,
    "last_seen_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mn_agent_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mn_agent_roles_workspace_id_slug_key"
    ON "mn_agent_roles"("workspace_id", "slug");

CREATE INDEX "mn_agent_roles_workspace_id_idx"
    ON "mn_agent_roles"("workspace_id");

ALTER TABLE "mn_agent_roles"
    ADD CONSTRAINT "mn_agent_roles_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
