-- Visa knowledge base (2026-06-12): HR-curated immigration guidance articles
-- shown contextually on a visa record. Idempotent (CLAUDE.md).

CREATE TABLE IF NOT EXISTS "visa_knowledge_articles" (
  "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
  "title"                TEXT         NOT NULL,
  "slug"                 TEXT         NOT NULL,
  "body"                 TEXT         NOT NULL,
  "country"              TEXT,
  "visa_type"            TEXT,
  "tags"                 TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "required_permissions" TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_active"            BOOLEAN      NOT NULL DEFAULT true,
  "created_by_id"        UUID,
  "entity_id"            UUID,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "visa_knowledge_articles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "visa_knowledge_articles_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "visa_knowledge_articles_slug_key"
  ON "visa_knowledge_articles" ("slug");

CREATE INDEX IF NOT EXISTS "visa_knowledge_articles_country_visa_type_is_active_idx"
  ON "visa_knowledge_articles" ("country", "visa_type", "is_active");
