-- Marketing feedback round #2 — projects gain admin-defined custom
-- fields. Pure additive; legacy rows default to an empty array.

ALTER TABLE "projects"
  ADD COLUMN "custom_fields" JSONB NOT NULL DEFAULT '[]'::jsonb;
