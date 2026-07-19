-- Epic 1.1 stub: session_assurance extension for Identity D1
-- ---------------------------------------------------------------------------
-- PREVIEW-ONLY / NOT AUTO-APPLIED.
-- Do not run against production. Do not invent a D1 database_id in wrangler.
-- When ops provisions a Manut-owned preview Identity D1, review Better Auth's
-- generated schema first, then apply this application-owned extension under
-- the same migration review gate as the master plan (§6.2).
--
-- Semantics:
--   - 1:1 with Better Auth `session` (session_id PK/FK)
--   - Created/upgraded atomically with the session or the session is unusable
--   - Sensitive routes reload amr/aal/acr/freshness/policy from D1 primary
--   - Never trust client claims, cookie-cache copies, or reconstructed amr
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS session_assurance (
  session_id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  -- JSON array of AuthenticationMethod strings, e.g. ["magic_link"]
  amr_json TEXT NOT NULL,
  aal TEXT NOT NULL CHECK (aal IN ('aal1', 'aal2', 'aal3')),
  acr TEXT,
  primary_authenticated_at INTEGER NOT NULL,
  mfa_authenticated_at INTEGER,
  assurance_policy_version TEXT NOT NULL,
  authenticated_by_ceremony_id TEXT NOT NULL,
  fresh_until INTEGER NOT NULL,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
  -- FK to Better Auth session(id) is added after the generated schema lands:
  -- FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_assurance_user_id
  ON session_assurance (user_id);

CREATE INDEX IF NOT EXISTS idx_session_assurance_policy
  ON session_assurance (assurance_policy_version);
