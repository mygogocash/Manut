-- IT Helpdesk module — single table for tickets created by employees
-- and worked through by the IT team on a Kanban board.
--
-- `ticket_number` is a friendly serial (IT-#) shown in the UI; `id`
-- stays a UUID so the URL doesn't leak ordering. `category` /
-- `priority` / `status` are free-text columns rather than enums so
-- HR / IT can add new buckets via a future migration without rebuilding
-- a Postgres enum type.
--
-- Idempotent: every CREATE uses IF NOT EXISTS so a partial-apply
-- incident can re-run cleanly.

CREATE TABLE IF NOT EXISTS "helpdesk_tickets" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "ticket_number"   SERIAL       NOT NULL,
  "title"           VARCHAR(200) NOT NULL,
  "description"     TEXT         NOT NULL,
  "category"        TEXT         NOT NULL DEFAULT 'other',
  "priority"        TEXT         NOT NULL DEFAULT 'medium',
  "status"          TEXT         NOT NULL DEFAULT 'open',
  "created_by"      UUID         NOT NULL,
  "assignee_id"     UUID,
  "resolution_note" TEXT,
  "resolved_at"     TIMESTAMP(3),
  "closed_at"       TIMESTAMP(3),
  "attachments"     JSONB,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "helpdesk_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "helpdesk_tickets_ticket_number_key"
  ON "helpdesk_tickets"("ticket_number");

CREATE INDEX IF NOT EXISTS "helpdesk_tickets_status_idx"
  ON "helpdesk_tickets"("status");

CREATE INDEX IF NOT EXISTS "helpdesk_tickets_created_by_idx"
  ON "helpdesk_tickets"("created_by");

CREATE INDEX IF NOT EXISTS "helpdesk_tickets_assignee_id_idx"
  ON "helpdesk_tickets"("assignee_id");

CREATE INDEX IF NOT EXISTS "helpdesk_tickets_category_idx"
  ON "helpdesk_tickets"("category");

-- FK to users for creator + assignee. `created_by` cascades so a
-- deactivated employee's tickets follow them out; `assignee_id` goes
-- NULL so the ticket survives an IT staff offboarding and an admin
-- can re-route it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'helpdesk_tickets_created_by_fkey'
  ) THEN
    ALTER TABLE "helpdesk_tickets"
      ADD CONSTRAINT "helpdesk_tickets_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'helpdesk_tickets_assignee_id_fkey'
  ) THEN
    ALTER TABLE "helpdesk_tickets"
      ADD CONSTRAINT "helpdesk_tickets_assignee_id_fkey"
      FOREIGN KEY ("assignee_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
