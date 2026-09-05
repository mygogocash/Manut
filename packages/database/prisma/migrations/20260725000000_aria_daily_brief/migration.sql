-- Phase 8 — proactive daily brief.
-- Idempotent: each statement uses IF NOT EXISTS / IF EXISTS so a
-- partial-apply incident is safe to re-run.

CREATE TABLE IF NOT EXISTS "aria_brief_subscriptions" (
    "user_id"           UUID PRIMARY KEY,
    "enabled"           BOOLEAN NOT NULL DEFAULT true,
    "hour_local"        INTEGER NOT NULL DEFAULT 7,
    "timezone"          TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "channels"          TEXT[] NOT NULL DEFAULT ARRAY['in_app','email']::TEXT[],
    "sections"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "weekdays_only"     BOOLEAN NOT NULL DEFAULT false,
    "last_delivered_at" TIMESTAMP(3),
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "aria_brief_subscriptions_user_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "aria_brief_subscriptions_enabled_hour_idx"
  ON "aria_brief_subscriptions" ("enabled", "hour_local");

CREATE TABLE IF NOT EXISTS "aria_brief_deliveries" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"        UUID NOT NULL,
    "delivered_on"   TEXT NOT NULL,
    "generated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload_json"   JSONB NOT NULL,
    "channel_status" JSONB NOT NULL DEFAULT '{}'::JSONB,
    CONSTRAINT "aria_brief_deliveries_user_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "aria_brief_deliveries_user_day_unique"
  ON "aria_brief_deliveries" ("user_id", "delivered_on");

CREATE INDEX IF NOT EXISTS "aria_brief_deliveries_user_generated_idx"
  ON "aria_brief_deliveries" ("user_id", "generated_at");

-- Grant the new perm to every non-Admin role by default. Permission
-- codes are string-typed in `role_permissions` — there is no separate
-- permissions table. Admin role bypasses every gate via auth.service,
-- so no row is needed for it.
INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r."id", 'aria:brief-subscribe'
FROM "roles" r
WHERE r."name" IN ('Employee', 'Manager', 'HR Manager', 'Accounting Manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp."role_id" = r."id"
      AND rp."permission_code" = 'aria:brief-subscribe'
  );
