-- Legal notice board — official internal announcements published by
-- the legal / compliance team (changes in authorised persons,
-- employee handbook updates, company policies, etc.).
--
-- Separate from `company_news` (social feed) because compliance needs
-- required acknowledgments and an audit trail per employee — that
-- can't sit on the news feed without bleeding social signals into
-- compliance reporting.
--
-- Idempotent: every CREATE / ALTER guards itself so a partial-apply
-- incident can re-run cleanly.

CREATE TABLE IF NOT EXISTS "legal_announcements" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "title"        VARCHAR(300) NOT NULL,
  "body"         TEXT         NOT NULL,
  "kind"         TEXT         NOT NULL DEFAULT 'other',
  "entity_id"    TEXT,
  "status"       TEXT         NOT NULL DEFAULT 'draft',
  "published_at" TIMESTAMP(3),
  "expires_at"   TIMESTAMP(3),
  "requires_ack" BOOLEAN      NOT NULL DEFAULT FALSE,
  "pinned"       BOOLEAN      NOT NULL DEFAULT FALSE,
  "author_id"    UUID         NOT NULL,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "legal_announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "legal_announcements_status_published_at_idx"
  ON "legal_announcements"("status", "published_at" DESC);

CREATE INDEX IF NOT EXISTS "legal_announcements_entity_id_idx"
  ON "legal_announcements"("entity_id");

CREATE INDEX IF NOT EXISTS "legal_announcements_kind_idx"
  ON "legal_announcements"("kind");

DO $$ BEGIN
  ALTER TABLE "legal_announcements"
    ADD CONSTRAINT "legal_announcements_entity_id_fkey"
    FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "legal_announcements"
    ADD CONSTRAINT "legal_announcements_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "legal_announcement_attachments" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "announcement_id" UUID         NOT NULL,
  "file_url"        TEXT         NOT NULL,
  "file_name"       VARCHAR(300) NOT NULL,
  "uploaded_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "legal_announcement_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "legal_announcement_attachments_announcement_id_idx"
  ON "legal_announcement_attachments"("announcement_id");

DO $$ BEGIN
  ALTER TABLE "legal_announcement_attachments"
    ADD CONSTRAINT "legal_announcement_attachments_announcement_id_fkey"
    FOREIGN KEY ("announcement_id") REFERENCES "legal_announcements"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "legal_announcement_acks" (
  "announcement_id" UUID         NOT NULL,
  "user_id"         UUID         NOT NULL,
  "acked_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acked_ip"        TEXT,

  CONSTRAINT "legal_announcement_acks_pkey" PRIMARY KEY ("announcement_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "legal_announcement_acks_user_id_idx"
  ON "legal_announcement_acks"("user_id");

DO $$ BEGIN
  ALTER TABLE "legal_announcement_acks"
    ADD CONSTRAINT "legal_announcement_acks_announcement_id_fkey"
    FOREIGN KEY ("announcement_id") REFERENCES "legal_announcements"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "legal_announcement_acks"
    ADD CONSTRAINT "legal_announcement_acks_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Seed: grant `legal:announcement-read` to every existing role so the
-- notice board is visible to all staff out of the box. The
-- `legal:announcement-manage` permission is *not* auto-granted — it
-- needs to be assigned to Legal / Admin roles explicitly via the
-- roles UI (avoids surprise write access). Skip when role_permissions
-- already has the row.
INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'legal:announcement-read'
FROM "roles" r
WHERE NOT EXISTS (
  SELECT 1 FROM "role_permissions" rp
  WHERE rp.role_id = r.id
    AND rp.permission_code = 'legal:announcement-read'
);

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'legal:announcement-manage'
FROM "roles" r
WHERE r.is_system = TRUE
  AND r.name = 'Admin'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id
      AND rp.permission_code = 'legal:announcement-manage'
  );
