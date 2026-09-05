-- Per-user DocuSign OAuth (Auth Code Grant). Stores encrypted access /
-- refresh tokens so envelopes can be sent from the user's own DocuSign
-- account instead of via the JWT-grant impersonation user.
-- Idempotent.

CREATE TABLE IF NOT EXISTS "user_docusign_connections" (
  "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"           UUID         NOT NULL,
  "access_token_enc"  TEXT         NOT NULL,
  "refresh_token_enc" TEXT         NOT NULL,
  "expires_at"        TIMESTAMP(3) NOT NULL,
  "account_id"        TEXT         NOT NULL,
  "base_uri"          TEXT         NOT NULL,
  "scopes"            TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_docusign_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_docusign_connections_user_id_key"
  ON "user_docusign_connections"("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_docusign_connections_user_id_fkey'
  ) THEN
    ALTER TABLE "user_docusign_connections"
      ADD CONSTRAINT "user_docusign_connections_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
