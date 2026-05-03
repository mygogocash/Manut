-- Add avatar JSON column to agents.
-- Stores a Picrew/Avataaars-style avatar configuration as a JSON object
-- (e.g. { topType, hairColor, eyeType, ... }). Server does not validate
-- the keys/values — the renderer falls back to defaults for unknowns.
ALTER TABLE "agents"
  ADD COLUMN IF NOT EXISTS "avatar" JSONB NOT NULL DEFAULT '{}';
