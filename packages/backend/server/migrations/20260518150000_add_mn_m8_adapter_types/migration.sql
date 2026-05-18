-- M8 — Cloud / sandbox agent adapter types
--
-- Extends MnAgentAdapterType with four new variants so MnAgents can be
-- bound to external execution surfaces (E2B sandboxes, Cursor cloud
-- agents, generic HTTP webhooks, allowlisted local process commands).
-- The existing COPILOT_CHAT_SESSION value stays — that's how M1 agents
-- bound to AiSession.agentId continue to dispatch.
--
-- ENUM ADD VALUE statements use IF NOT EXISTS so re-applying this
-- migration on a partially-migrated DB is safe (CLAUDE.md §5 deploy
-- hygiene).

ALTER TYPE "MnAgentAdapterType" ADD VALUE IF NOT EXISTS 'E2B_SANDBOX';
ALTER TYPE "MnAgentAdapterType" ADD VALUE IF NOT EXISTS 'CURSOR_CLOUD';
ALTER TYPE "MnAgentAdapterType" ADD VALUE IF NOT EXISTS 'HTTP_WEBHOOK';
ALTER TYPE "MnAgentAdapterType" ADD VALUE IF NOT EXISTS 'PROCESS_COMMAND';
