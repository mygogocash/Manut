-- Marketing feedback round #2 — Wiki / Sticky repository.

CREATE TABLE "wiki_pages" (
  "id"             UUID    NOT NULL DEFAULT gen_random_uuid(),
  "title"          TEXT    NOT NULL,
  "folder"         TEXT,
  "body"           TEXT    NOT NULL,
  "slug"           TEXT,
  "is_published"   BOOLEAN NOT NULL DEFAULT true,
  "created_by_id"  UUID    NOT NULL,
  "updated_by_id"  UUID    NOT NULL,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wiki_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wiki_pages_slug_key" ON "wiki_pages"("slug");
CREATE INDEX "wiki_pages_folder_idx" ON "wiki_pages"("folder");
CREATE INDEX "wiki_pages_is_published_updated_at_idx"
  ON "wiki_pages"("is_published", "updated_at" DESC);

ALTER TABLE "wiki_pages"
  ADD CONSTRAINT "wiki_pages_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "wiki_pages"
  ADD CONSTRAINT "wiki_pages_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE CASCADE;
