-- Partner detail URLs: `/partners/{company-slug}-{id}`

ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "slug" TEXT;

UPDATE "partners"
SET    "slug" = regexp_replace(
         regexp_replace(lower(trim("company")), '[^a-z0-9]+', '-', 'g'),
         '(^-+|-+$)', '', 'g'
       ) || '-' || "id"
WHERE  "slug" IS NULL OR trim("slug") = '';

UPDATE "partners"
SET    "slug" = 'partner-' || "id"
WHERE  "slug" IS NULL OR trim("slug") = '';

ALTER TABLE "partners" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "partners_slug_key" ON "partners"("slug");
