-- Certificates: recognition/award certificates issued by Admin/HR and emailed
-- to an employee as a generated PDF (download link). Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS "certificates" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "recipient_id"    UUID         NOT NULL,
    "recipient_name"  VARCHAR(200) NOT NULL,
    "recipient_email" VARCHAR(255) NOT NULL,
    "title"           VARCHAR(200) NOT NULL,
    "message"         TEXT,
    "type"            VARCHAR(40)  NOT NULL DEFAULT 'achievement',
    "signatories"     JSONB        NOT NULL DEFAULT '[]',
    "file_url"        TEXT,
    "status"          VARCHAR(20)  NOT NULL DEFAULT 'draft',
    "issued_by_id"    UUID,
    "issued_at"       TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "certificates_recipient_id_idx" ON "certificates"("recipient_id");
CREATE INDEX IF NOT EXISTS "certificates_issued_by_id_idx" ON "certificates"("issued_by_id");
CREATE INDEX IF NOT EXISTS "certificates_status_idx" ON "certificates"("status");

DO $$ BEGIN
    ALTER TABLE "certificates"
        ADD CONSTRAINT "certificates_recipient_id_fkey"
        FOREIGN KEY ("recipient_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "certificates"
        ADD CONSTRAINT "certificates_issued_by_id_fkey"
        FOREIGN KEY ("issued_by_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Grant certificate permissions to Admin + HR Manager. (Admin also holds every
-- code via the auth resolver bypass; this keeps the DB rows consistent too.)
INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r."id", c."code"
FROM "roles" r
CROSS JOIN (VALUES ('certificate:read'), ('certificate:manage')) AS c("code")
WHERE r."name" IN ('Admin', 'HR Manager')
ON CONFLICT ("role_id", "permission_code") DO NOTHING;
