-- Web Push subscriptions.
--
-- Additive and idempotent: creates one new table and its indexes, alters
-- nothing existing. There is no data migration, so nothing is lost when
-- staging syncs by `db:push` instead of `migrate deploy`.
--
-- Rationale, lifecycle, security and rollback: docs/pwa/PHASE_6_SCHEMA_PROPOSAL.md

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  -- No DB default: `@default(uuid())` makes Prisma generate the id client-side,
  -- so a `gen_random_uuid()` default here is drift the schema does not know
  -- about. Matches `it_crm_notifications` and every other uuid table here.
  "id"              uuid         NOT NULL,
  "user_id"         uuid         NOT NULL,
  "endpoint"        text         NOT NULL,
  "p256dh"          text         NOT NULL,
  "auth"            text         NOT NULL,
  "user_agent"      text,
  "failure_count"   integer      NOT NULL DEFAULT 0,
  "last_success_at" timestamp(3),
  "created_at"      timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      timestamp(3) NOT NULL,
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- A browser reissues the same endpoint for the same device, so re-subscribing
-- must update the existing row rather than accumulate duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key"
  ON "push_subscriptions" ("endpoint");

-- The only read path: every active device for one recipient.
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx"
  ON "push_subscriptions" ("user_id");
