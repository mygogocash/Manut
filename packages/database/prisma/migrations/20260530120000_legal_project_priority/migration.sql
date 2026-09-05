-- Legal CRM flat tasks (`legal_projects`) — priority for triage in list/board views.
ALTER TABLE "legal_projects"
ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'medium';
