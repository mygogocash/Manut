-- Append-only discussion thread on each IT helpdesk ticket. Requester
-- and assignee can both write so the conversation lives next to the
-- ticket instead of fanning out into Slack / email. Idempotent so the
-- migration is safe to re-apply.
CREATE TABLE IF NOT EXISTS "helpdesk_comments" (
    "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "ticket_id"  UUID         NOT NULL,
    "author_id"  UUID         NOT NULL,
    "body"       TEXT         NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "helpdesk_comments_ticket_fk"
        FOREIGN KEY ("ticket_id")
        REFERENCES "helpdesk_tickets"("id")
        ON DELETE CASCADE,
    CONSTRAINT "helpdesk_comments_author_fk"
        FOREIGN KEY ("author_id")
        REFERENCES "users"("id")
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "helpdesk_comments_ticket_id_created_at_idx"
    ON "helpdesk_comments" ("ticket_id", "created_at");
