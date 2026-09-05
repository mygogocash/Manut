-- Seed a starter SurveyDefinition so the xlsx-import "Create Survey Wave"
-- dialog's "Survey Definition" dropdown is populated in production (the prod
-- seed never created one, leaving the dropdown empty and blocking wave
-- creation). Idempotent: only inserts when the table is empty, so it never
-- duplicates and is safe to re-run. HR can add more definitions later.

INSERT INTO "survey_definitions" (
  "id", "version_name", "description", "sections_schema",
  "demographics_schema", "feedback_columns", "total_questions", "is_active"
)
SELECT
  gen_random_uuid(),
  'Pulse Engagement Survey',
  'Starter engagement survey definition (6 sections + open feedback). Use as-is or duplicate and edit for future waves.',
  '[
    {"key":"roleClarity","label":"Role Clarity","questionCount":7,"prefix":"Q_RC"},
    {"key":"managerEffectiveness","label":"Manager Effectiveness","questionCount":6,"prefix":"Q_ME"},
    {"key":"teamDynamics","label":"Team Dynamics","questionCount":6,"prefix":"Q_TD"},
    {"key":"orgEffectiveness","label":"Org Effectiveness","questionCount":6,"prefix":"Q_OE"},
    {"key":"leadershipTrust","label":"Leadership Trust","questionCount":6,"prefix":"Q_LT"},
    {"key":"engagementRetention","label":"Engagement and Retention","questionCount":4,"prefix":"Q_ER"}
  ]'::jsonb,
  '{}'::jsonb,
  '[
    {"key":"feedbackStartDoing","header":"Feedback_StartDoing"},
    {"key":"feedbackStopDoing","header":"Feedback_StopDoing"},
    {"key":"feedbackContinueDoing","header":"Feedback_ContinueDoing"},
    {"key":"feedbackGeneral","header":"Feedback_General"}
  ]'::jsonb,
  35,
  true
WHERE NOT EXISTS (SELECT 1 FROM "survey_definitions");
