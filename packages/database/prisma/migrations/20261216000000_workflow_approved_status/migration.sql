-- Rename the post-approval workflow status: pending_development -> approved.
--
-- The status was only ever the signal that a request had been approved and its
-- board could be unblocked. Calling it `pending_development` asserted something
-- that is not always true — that every approved request has a development phase
-- — and made the close-out read as mandatory when it never was.
--
-- Nothing about behaviour changes here. `approved` unblocks the board exactly as
-- `pending_development` did, and `complete` is still available on it; it is
-- simply no longer implied that somebody owes it.
--
-- Idempotent: the WHERE clause matches only rows still on the old value, so
-- re-running is a no-op. The code also recognises the old value, so a row missed
-- by this (or written by an older container mid-deploy) still reads and still
-- moves.

UPDATE "projects"
SET "workflow_status" = 'approved'
WHERE "workflow_status" = 'pending_development';

-- Transition history is deliberately NOT rewritten. Those rows record what the
-- status was called when each decision was taken, and rewriting them would
-- falsify the log.
