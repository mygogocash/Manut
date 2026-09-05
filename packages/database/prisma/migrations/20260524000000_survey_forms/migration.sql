-- Survey forms — Google-Forms-style in-platform surveys.
--
-- Runs alongside the existing `survey_definitions` / `survey_waves`
-- xlsx-import system; nothing in those tables is touched.

CREATE TABLE IF NOT EXISTS "survey_forms" (
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
  "created_by_id"       UUID         NOT NULL,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "survey_forms_creator_fk"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "survey_forms_status_idx"
  ON "survey_forms" ("status");

CREATE INDEX IF NOT EXISTS "survey_forms_created_by_idx"
  ON "survey_forms" ("created_by_id");

CREATE TABLE IF NOT EXISTS "survey_form_questions" (
  "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "survey_form_id" UUID         NOT NULL,
  "order"          INTEGER      NOT NULL,
  "type"           VARCHAR(30)  NOT NULL,
  "prompt"         TEXT         NOT NULL,
  "helper_text"    TEXT,
  "required"       BOOLEAN      NOT NULL DEFAULT FALSE,
  "options"        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  "settings"       JSONB        NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT "survey_form_questions_form_fk"
    FOREIGN KEY ("survey_form_id") REFERENCES "survey_forms"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "survey_form_questions_form_order_idx"
  ON "survey_form_questions" ("survey_form_id", "order");

CREATE TABLE IF NOT EXISTS "survey_form_responses" (
  "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "survey_form_id" UUID         NOT NULL,
  "respondent_id"  UUID,
  "submitted_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "survey_form_responses_form_fk"
    FOREIGN KEY ("survey_form_id") REFERENCES "survey_forms"("id") ON DELETE CASCADE,
  CONSTRAINT "survey_form_responses_respondent_fk"
    FOREIGN KEY ("respondent_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "survey_form_responses_form_respondent_uq"
  ON "survey_form_responses" ("survey_form_id", "respondent_id");

CREATE INDEX IF NOT EXISTS "survey_form_responses_form_idx"
  ON "survey_form_responses" ("survey_form_id");

CREATE TABLE IF NOT EXISTS "survey_form_answers" (
  "id"          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  "response_id" UUID  NOT NULL,
  "question_id" UUID  NOT NULL,
  "value"       JSONB NOT NULL,

  CONSTRAINT "survey_form_answers_response_fk"
    FOREIGN KEY ("response_id") REFERENCES "survey_form_responses"("id") ON DELETE CASCADE,
  CONSTRAINT "survey_form_answers_question_fk"
    FOREIGN KEY ("question_id") REFERENCES "survey_form_questions"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "survey_form_answers_response_question_uq"
  ON "survey_form_answers" ("response_id", "question_id");

CREATE INDEX IF NOT EXISTS "survey_form_answers_question_idx"
  ON "survey_form_answers" ("question_id");
