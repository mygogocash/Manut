-- AlterTable: add verification columns to workspace_pages
ALTER TABLE "workspace_pages"
  ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "verified_by" VARCHAR,
  ADD COLUMN IF NOT EXISTS "verification_expires_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "workspace_pages_workspace_id_verified_at_idx" ON "workspace_pages"("workspace_id", "verified_at");

-- CreateTable
CREATE TABLE IF NOT EXISTS "integration_connections" (
    "id" VARCHAR NOT NULL,
    "user_id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "provider" VARCHAR NOT NULL,
    "external_id" VARCHAR NOT NULL,
    "display_name" VARCHAR NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMPTZ(3),
    "scopes" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "integration_connections_user_id_workspace_id_provider_key" ON "integration_connections"("user_id", "workspace_id", "provider");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_connections_user_id_workspace_id_idx" ON "integration_connections"("user_id", "workspace_id");

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "mcp_api_keys" (
    "id" VARCHAR NOT NULL,
    "user_id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR,
    "key_hash" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3),

    CONSTRAINT "mcp_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_api_keys_key_hash_key" ON "mcp_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mcp_api_keys_user_id_idx" ON "mcp_api_keys"("user_id");

-- AddForeignKey
ALTER TABLE "mcp_api_keys" ADD CONSTRAINT "mcp_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
