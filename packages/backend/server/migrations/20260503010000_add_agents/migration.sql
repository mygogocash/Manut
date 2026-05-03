-- agents
-- Each agent has metadata (name, description, instructions), arrays of skills,
-- file refs (blob keys), JSON link list, and an optional self-referential
-- parent for sub-agents. Workspace-scoped; cascades on workspace delete.
CREATE TABLE IF NOT EXISTS "agents" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "owner_id" VARCHAR NOT NULL,
    "parent_agent_id" VARCHAR,
    "name" VARCHAR NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "links" JSONB NOT NULL DEFAULT '[]',
    "files" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agents_workspace_id_idx"
  ON "agents"("workspace_id");

CREATE INDEX IF NOT EXISTS "agents_parent_agent_id_idx"
  ON "agents"("parent_agent_id");

-- Workspace FK with cascade: deleting a workspace removes all its agents.
ALTER TABLE "agents"
  ADD CONSTRAINT "agents_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Owner FK: keep agents alive if owner is deleted (set null would change
-- semantics; cascade matches workspace-scoped resources elsewhere).
ALTER TABLE "agents"
  ADD CONSTRAINT "agents_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Self-referential FK for sub-agents. Cascade so deleting a parent removes
-- its sub-tree (consistent with the model expectation that sub-agents are
-- owned children of their parent).
ALTER TABLE "agents"
  ADD CONSTRAINT "agents_parent_agent_id_fkey"
  FOREIGN KEY ("parent_agent_id") REFERENCES "agents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
