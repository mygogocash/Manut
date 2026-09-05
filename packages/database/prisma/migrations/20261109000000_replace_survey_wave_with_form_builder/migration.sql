-- Replace the retired xlsx-import "wave" survey system with a standalone
-- Survey form-builder (a clone of the survey_forms/Awards engine, own tables).
-- Idempotent — safe to re-run. Drop the wave tables first (children first for
-- FK order), then create the new survey_* tables. survey_responses is dropped
-- (wave shape) and recreated (form-builder shape) in that order.
--
-- NOTE: the wave tables carry pulse-survey response data. Dropping them is
-- intentional (the feature is retired). This runs on prod via `migrate deploy`;
-- staging syncs schema via `db push`. Export wave data before prod promotion if
-- it must be retained.

DROP TABLE IF EXISTS "upload_jobs" CASCADE;
DROP TABLE IF EXISTS "survey_responses" CASCADE;
DROP TABLE IF EXISTS "survey_waves" CASCADE;
DROP TABLE IF EXISTS "survey_definitions" CASCADE;

-- ─── surveys ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "surveys" (
  "id"                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "title"               VARCHAR(200) NOT NULL,
  "description"         TEXT,
  "status"              VARCHAR(20)  NOT NULL DEFAULT 'draft',
  "is_anonymous"        BOOLEAN      NOT NULL DEFAULT FALSE,
  "target_all"          BOOLEAN      NOT NULL DEFAULT TRUE,
  "target_entity_ids"   JSONB        NOT NULL DEFAULT '[]'::jsonb,
  "target_departments"  JSONB        NOT NULL DEFAULT '[]'::jsonb,
  "target_user_ids"     JSONB        NOT NULL DEFAULT '[]'::jsonb,
  "published_at"        TIMESTAMP(3),
  "closed_at"           TIMESTAMP(3),
  "start_date"          DATE,
  "end_date"            DATE,
  "archived_at"         TIMESTAMP(3),
  "created_by_id"       UUID         NOT NULL,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "surveys_creator_fk"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "surveys_status_idx" ON "surveys" ("status");
CREATE INDEX IF NOT EXISTS "surveys_created_by_idx" ON "surveys" ("created_by_id");
CREATE INDEX IF NOT EXISTS "surveys_archived_at_idx" ON "surveys" ("archived_at");
CREATE INDEX IF NOT EXISTS "surveys_end_date_idx" ON "surveys" ("end_date");

-- ─── survey_questions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "survey_questions" (
  "id"          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "survey_id"   UUID         NOT NULL,
  "order"       INTEGER      NOT NULL,
  "type"        VARCHAR(30)  NOT NULL,
  "prompt"      TEXT         NOT NULL,
  "helper_text" TEXT,
  "required"    BOOLEAN      NOT NULL DEFAULT FALSE,
  "options"     JSONB        NOT NULL DEFAULT '[]'::jsonb,
  "settings"    JSONB        NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT "survey_questions_survey_fk"
    FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "survey_questions_survey_order_idx"
  ON "survey_questions" ("survey_id", "order");

-- ─── survey_responses ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "survey_responses" (
  "id"           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "survey_id"    UUID         NOT NULL,
  "respondent_id" UUID,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "survey_responses_survey_fk"
    FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE,
  CONSTRAINT "survey_responses_respondent_fk"
    FOREIGN KEY ("respondent_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "survey_responses_survey_respondent_uq"
  ON "survey_responses" ("survey_id", "respondent_id");

CREATE INDEX IF NOT EXISTS "survey_responses_survey_idx"
  ON "survey_responses" ("survey_id");

-- ─── survey_answers ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "survey_answers" (
  "id"          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  "response_id" UUID  NOT NULL,
  "question_id" UUID  NOT NULL,
  "value"       JSONB NOT NULL,

  CONSTRAINT "survey_answers_response_fk"
    FOREIGN KEY ("response_id") REFERENCES "survey_responses"("id") ON DELETE CASCADE,
  CONSTRAINT "survey_answers_question_fk"
    FOREIGN KEY ("question_id") REFERENCES "survey_questions"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "survey_answers_response_question_uq"
  ON "survey_answers" ("response_id", "question_id");

CREATE INDEX IF NOT EXISTS "survey_answers_question_idx"
  ON "survey_answers" ("question_id");

-- ─── grant survey:manage to Admin + HR Manager ───────────
INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'survey:manage'
FROM "roles" r
WHERE ((r.is_system = TRUE AND r.name = 'Admin') OR r.name = 'HR Manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_code = 'survey:manage'
  );

-- Retire the wave-only permission codes (survey:manage-wave stays — Awards uses it).
DELETE FROM "role_permissions"
WHERE permission_code IN (
  'survey:upload', 'survey:analytics', 'survey:export-scores',
  'survey:export-raw', 'survey:view-jobs'
);
