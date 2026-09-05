-- Legal document sharing — let the legal team grant read access to a
-- specific user, a department, a user group, or every active
-- employee (via `visibility = 'public'`).
--
-- Default `visibility = 'private'` keeps existing rows behind the
-- `legal:read` perm so this migration is non-breaking; only newly
-- shared rows surface to non-legal employees.
--
-- Idempotent: every CREATE / ALTER guards itself so a partial-apply
-- incident can re-run cleanly.

ALTER TABLE "legal_documents"
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'private';

CREATE INDEX IF NOT EXISTS "legal_documents_visibility_idx"
  ON "legal_documents"("visibility");

CREATE TABLE IF NOT EXISTS "legal_document_shares" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "document_id"    UUID         NOT NULL,
  "type"           TEXT         NOT NULL,
  "user_id"        UUID,
  "department"     TEXT,
  "group_id"       UUID,
  "created_by_id"  UUID,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "legal_document_shares_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "legal_document_shares_document_id_idx"
  ON "legal_document_shares"("document_id");

CREATE INDEX IF NOT EXISTS "legal_document_shares_user_id_idx"
  ON "legal_document_shares"("user_id");

CREATE INDEX IF NOT EXISTS "legal_document_shares_department_idx"
  ON "legal_document_shares"("department");

CREATE INDEX IF NOT EXISTS "legal_document_shares_group_id_idx"
  ON "legal_document_shares"("group_id");

DO $$ BEGIN
  ALTER TABLE "legal_document_shares"
    ADD CONSTRAINT "legal_document_shares_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "legal_documents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "legal_document_shares"
    ADD CONSTRAINT "legal_document_shares_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "legal_document_shares"
    ADD CONSTRAINT "legal_document_shares_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "user_groups"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "legal_document_shares"
    ADD CONSTRAINT "legal_document_shares_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Seed `legal:view-shared` on every existing role so any employee can
-- see documents shared with them out of the box. The `legal:share`
-- permission is only auto-granted to the system Admin role; legal
-- staff need explicit assignment via the Roles UI.
INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'legal:view-shared'
FROM "roles" r
WHERE NOT EXISTS (
  SELECT 1 FROM "role_permissions" rp
  WHERE rp.role_id = r.id
    AND rp.permission_code = 'legal:view-shared'
);

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'legal:share'
FROM "roles" r
WHERE r.is_system = TRUE
  AND r.name = 'Admin'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id
      AND rp.permission_code = 'legal:share'
  );
