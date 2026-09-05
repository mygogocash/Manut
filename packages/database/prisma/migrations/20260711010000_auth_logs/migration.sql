-- Auth recovery (May 2026) — back the forgot-password + magic-link
-- flows with a pre-auth attempt log. Two consumers:
--   1. Sliding-window rate limiter (3 attempts per email/hour,
--      10 per IP/hour). The composite (email, action, created_at)
--      index serves the email-side query; (ip, created_at) serves
--      the IP-side query.
--   2. Post-incident SOC audit — "who attempted recovery for
--      account X from which IP in the last 30 days".
--
-- Idempotent: `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT
-- EXISTS` so a partial-apply restart re-runs cleanly. Re-running on
-- an already-applied prod DB is a no-op.

CREATE TABLE IF NOT EXISTS "auth_logs" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "email"          VARCHAR(254) NOT NULL,
  "ip"             VARCHAR(64),
  "action"         VARCHAR(32) NOT NULL,
  "success"        BOOLEAN NOT NULL,
  "error_message"  VARCHAR(500),
  "user_id"        UUID,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auth_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "auth_logs_email_action_created_at_idx"
  ON "auth_logs" ("email", "action", "created_at");

CREATE INDEX IF NOT EXISTS "auth_logs_ip_created_at_idx"
  ON "auth_logs" ("ip", "created_at");

CREATE INDEX IF NOT EXISTS "auth_logs_created_at_idx"
  ON "auth_logs" ("created_at");
