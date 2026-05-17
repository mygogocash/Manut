-- Add URL slug for workspaces (used in /workspace/:slug/... routes).
ALTER TABLE "workspaces" ADD COLUMN "slug" VARCHAR;

UPDATE "workspaces"
SET "slug" = LOWER(
  REGEXP_REPLACE(
    COALESCE(NULLIF(TRIM("name"), ''), 'workspace'),
    '[^a-zA-Z0-9]+',
    '-',
    'g'
  )
) || '-' || SUBSTRING(REPLACE("id", '-', '') FROM 1 FOR 8)
WHERE "slug" IS NULL;

UPDATE "workspaces"
SET "slug" = 'workspace-' || SUBSTRING(REPLACE("id", '-', '') FROM 1 FOR 12)
WHERE "slug" IS NULL OR "slug" = '';

ALTER TABLE "workspaces" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");
