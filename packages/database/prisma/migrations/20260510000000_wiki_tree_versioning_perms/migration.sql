-- Wiki: hierarchical tree, page-level permissions, and version history.

-- ── 1. Tree + access columns on wiki_pages ─────────────────────────────
ALTER TABLE "wiki_pages"
  ADD COLUMN IF NOT EXISTS "parent_id" UUID,
  ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_restricted" BOOLEAN NOT NULL DEFAULT FALSE;

DO $$ BEGIN
  ALTER TABLE "wiki_pages"
    ADD CONSTRAINT "wiki_pages_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "wiki_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "wiki_pages_parent_id_position_idx"
  ON "wiki_pages"("parent_id", "position");

-- ── 2. Version history ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "wiki_page_versions" (
  "id"            UUID PRIMARY KEY,
  "page_id"       UUID NOT NULL,
  "version"       INTEGER NOT NULL,
  "title"         TEXT NOT NULL,
  "body"          TEXT NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" UUID NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "wiki_page_versions"
    ADD CONSTRAINT "wiki_page_versions_page_id_fkey"
    FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "wiki_page_versions"
    ADD CONSTRAINT "wiki_page_versions_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "wiki_page_versions_page_id_version_key"
  ON "wiki_page_versions"("page_id", "version");
CREATE INDEX IF NOT EXISTS "wiki_page_versions_page_id_created_at_idx"
  ON "wiki_page_versions"("page_id", "created_at" DESC);

-- ── 3. Per-page permissions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "wiki_page_permissions" (
  "id"          UUID PRIMARY KEY,
  "page_id"     UUID NOT NULL,
  "user_id"     UUID NOT NULL,
  "level"       TEXT NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "wiki_page_permissions"
    ADD CONSTRAINT "wiki_page_permissions_page_id_fkey"
    FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "wiki_page_permissions"
    ADD CONSTRAINT "wiki_page_permissions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "wiki_page_permissions_page_id_user_id_key"
  ON "wiki_page_permissions"("page_id", "user_id");
CREATE INDEX IF NOT EXISTS "wiki_page_permissions_user_id_idx"
  ON "wiki_page_permissions"("user_id");
