-- Legal team feedback (2026-05-25): tag Legal Tasks with the broader
-- workstream they belong to (e.g. "Token Launch", "Partnerships",
-- "Compliance"). Free-text and nullable; promote to a controlled
-- vocabulary later if the legal team accumulates a stable taxonomy.
-- Idempotent so a partial roll-out can re-run safely.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "workstream" TEXT;
