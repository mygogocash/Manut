-- Rename the helpdesk ticket "waiting" status to "review". The new
-- semantic: the IT team has done the work and is waiting for the
-- requester to confirm before closing. UI label is also "Review".
--
-- Idempotent: the UPDATE is gated on the legacy value and is a no-op
-- once all rows have been migrated.

UPDATE "helpdesk_tickets"
SET "status" = 'review'
WHERE "status" = 'waiting';
