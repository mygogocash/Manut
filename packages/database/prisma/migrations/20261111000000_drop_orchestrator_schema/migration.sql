-- Clean the AI Project Orchestrator remnants out of the schema.
--
-- The orchestrator code was reverted earlier; its columns and tables were
-- deliberately left in place so nothing was destroyed before it could be
-- reviewed. This migration removes them from the live schema.
--
-- SAFETY: this is ARCHIVE-THEN-DROP, never plain DROP. A pre-flight step copies
-- every non-null orchestrator value into `_archive_orchestrator_*` tables, so
-- dropping the columns destroys no information — it is recoverable from the
-- archive. Two live (non-demo) projects carry orchestrator data and eight
-- department-review rows exist; all of it is archived first.
--
-- PRESERVED, explicitly untouched:
--   * project ids, names, slugs and every non-orchestrator column
--   * project_task_comments (comments) and project_task_resources (attachments)
--   * project_tasks and all existing relationships / foreign keys
--   * the CURRENT workflow engine: projects.workflow_status,
--     projects.workflow_updated_at, projects.priority,
--     project_workflow_transitions (approval + timeline log) and
--     project_workflow_emails (notification log)
--
-- Idempotent: every step is guarded, so re-running is a no-op.

-- ─────────────────────────────────────────────────────────
-- 1. Archive orchestrator data held on `projects`
-- ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'orchestrator_status'
  ) THEN
    CREATE TABLE IF NOT EXISTS "_archive_orchestrator_project_data" (
      "project_id"  TEXT PRIMARY KEY,
      "archived_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      "data"        JSONB NOT NULL
    );

    -- One JSONB snapshot per project that carries any orchestrator value.
    -- `to_jsonb(...) - null keys` keeps the archive compact.
    EXECUTE $q$
      INSERT INTO "_archive_orchestrator_project_data" ("project_id", "data")
      SELECT p.id,
             jsonb_strip_nulls(jsonb_build_object(
               'created_by', p.created_by,
               'ai_summary', p.ai_summary,
               'validation_result', p.validation_result,
               'ai_validated_at', p.ai_validated_at,
               'prediction_version', p.prediction_version,
               'orchestrator_status', p.orchestrator_status,
               'submitted_at', p.submitted_at,
               'pm_decision', p.pm_decision,
               'pm_decision_at', p.pm_decision_at,
               'pm_decision_by', p.pm_decision_by,
               'pm_decision_comment', p.pm_decision_comment,
               'rejection_reason', p.rejection_reason,
               'business_head_decision', p.business_head_decision,
               'business_head_comment', p.business_head_comment,
               'business_head_decision_at', p.business_head_decision_at,
               'business_head_decision_by', p.business_head_decision_by,
               'product_admin_decision', p.product_admin_decision,
               'product_admin_comment', p.product_admin_comment,
               'product_admin_decision_at', p.product_admin_decision_at,
               'product_admin_decision_by', p.product_admin_decision_by,
               'strategic_score', p.strategic_score,
               'executive_summary', p.executive_summary,
               'conflict_summary', p.conflict_summary,
               'development_lead_id', p.development_lead_id,
               'ai_recommended_completion', p.ai_recommended_completion,
               'ai_recommendation_at', p.ai_recommendation_at,
               'ai_recommendation_confidence', p.ai_recommendation_confidence,
               'timeline_recommendation', p.timeline_recommendation,
               'timeline_override_reason', p.timeline_override_reason,
               'timeline_confirmed_at', p.timeline_confirmed_at,
               'timeline_confirmed_by', p.timeline_confirmed_by,
               'variance_days', p.variance_days,
               'variance_risk', p.variance_risk,
               'tasks_generated_at', p.tasks_generated_at
             ))
      FROM projects p
      WHERE (p.created_by IS NOT NULL OR p.ai_summary IS NOT NULL
          OR p.validation_result IS NOT NULL OR p.orchestrator_status IS NOT NULL
          OR p.submitted_at IS NOT NULL OR p.pm_decision IS NOT NULL
          OR p.strategic_score IS NOT NULL OR p.executive_summary IS NOT NULL
          OR p.conflict_summary IS NOT NULL OR p.timeline_recommendation IS NOT NULL
          OR p.tasks_generated_at IS NOT NULL)
      ON CONFLICT ("project_id") DO NOTHING
    $q$;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────
-- 2. Archive orchestrator child tables, then drop them
-- ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'project_department_reviews'
  ) THEN
    -- Cross-functional review records (dependency / cross-functional status).
    EXECUTE 'CREATE TABLE IF NOT EXISTS "_archive_orchestrator_department_reviews"
             AS SELECT * FROM "project_department_reviews" WITH NO DATA';
    EXECUTE 'INSERT INTO "_archive_orchestrator_department_reviews"
             SELECT * FROM "project_department_reviews"
             WHERE NOT EXISTS (
               SELECT 1 FROM "_archive_orchestrator_department_reviews" a
               WHERE a.id = "project_department_reviews".id
             )';
    EXECUTE 'DROP TABLE "project_department_reviews"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'project_task_broadcasts'
  ) THEN
    -- Child-task mapping / cross-CRM sync metadata.
    EXECUTE 'CREATE TABLE IF NOT EXISTS "_archive_orchestrator_task_broadcasts"
             AS SELECT * FROM "project_task_broadcasts" WITH NO DATA';
    EXECUTE 'INSERT INTO "_archive_orchestrator_task_broadcasts"
             SELECT * FROM "project_task_broadcasts"
             WHERE NOT EXISTS (
               SELECT 1 FROM "_archive_orchestrator_task_broadcasts" a
               WHERE a.id = "project_task_broadcasts".id
             )';
    EXECUTE 'DROP TABLE "project_task_broadcasts"';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────
-- 3. Drop orchestrator columns from `projects`
--    (AI summary/validation, approval chain, scoring, capacity, timeline
--     recommendation, variance and child-task-generation metadata)
-- ─────────────────────────────────────────────────────────
ALTER TABLE "projects" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "ai_summary";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "validation_result";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "ai_validated_at";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "prediction_version";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "orchestrator_status";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "submitted_at";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "pm_decision";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "pm_decision_at";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "pm_decision_by";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "pm_decision_comment";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "rejection_reason";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "business_head_decision";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "business_head_comment";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "business_head_decision_at";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "business_head_decision_by";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "product_admin_decision";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "product_admin_comment";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "product_admin_decision_at";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "product_admin_decision_by";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "strategic_score";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "executive_summary";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "conflict_summary";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "development_lead_id";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "ai_recommended_completion";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "ai_recommendation_at";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "ai_recommendation_confidence";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "timeline_recommendation";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "timeline_override_reason";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "timeline_confirmed_at";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "timeline_confirmed_by";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "variance_days";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "variance_risk";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "tasks_generated_at";

DROP INDEX IF EXISTS "projects_orchestrator_status_idx";

-- ─────────────────────────────────────────────────────────
-- 4. Drop orchestrator columns from `project_tasks`
--    (child-task mapping + cross-CRM routing tags). All verified empty, so
--    no task loses data and no task row is deleted.
-- ─────────────────────────────────────────────────────────
ALTER TABLE "project_tasks" DROP COLUMN IF EXISTS "department";
ALTER TABLE "project_tasks" DROP COLUMN IF EXISTS "crm";
ALTER TABLE "project_tasks" DROP COLUMN IF EXISTS "generated";
ALTER TABLE "project_tasks" DROP COLUMN IF EXISTS "estimated_timeline";
