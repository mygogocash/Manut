-- Superflow: project management, CRM, reminders, notification deliveries

CREATE TYPE "SfProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TYPE "SfTaskStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

CREATE TYPE "SfTaskPriority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TYPE "SfCrmActivityType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'OTHER');

CREATE TYPE "SfReminderStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED');

CREATE TYPE "SfReminderRuleTrigger" AS ENUM ('DATETIME', 'OVERDUE_TASK', 'INACTIVITY', 'UPCOMING_DEADLINE');

CREATE TYPE "SfNotificationChannel" AS ENUM ('EMAIL');

CREATE TYPE "SfNotificationDeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "sf_projects" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "status" "SfProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" VARCHAR,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sf_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_project_members" (
    "id" VARCHAR NOT NULL,
    "project_id" VARCHAR NOT NULL,
    "user_id" VARCHAR NOT NULL,
    "role_label" VARCHAR,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sf_project_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_tasks" (
    "id" VARCHAR NOT NULL,
    "project_id" VARCHAR NOT NULL,
    "title" VARCHAR NOT NULL,
    "description" TEXT,
    "status" "SfTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "SfTaskPriority" NOT NULL DEFAULT 'NONE',
    "due_at" TIMESTAMPTZ(3),
    "list_sort_order" INTEGER NOT NULL DEFAULT 0,
    "assignee_user_id" VARCHAR,
    "created_by_user_id" VARCHAR,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sf_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_task_comments" (
    "id" VARCHAR NOT NULL,
    "task_id" VARCHAR NOT NULL,
    "author_id" VARCHAR NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sf_task_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_task_activities" (
    "id" VARCHAR NOT NULL,
    "task_id" VARCHAR NOT NULL,
    "actor_id" VARCHAR,
    "action" VARCHAR NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sf_task_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_crm_accounts" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "website" VARCHAR,
    "industry" VARCHAR,
    "notes" TEXT,
    "owner_user_id" VARCHAR,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sf_crm_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_crm_contacts" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "account_id" VARCHAR,
    "first_name" VARCHAR NOT NULL,
    "last_name" VARCHAR,
    "email" VARCHAR,
    "phone" VARCHAR,
    "title" VARCHAR,
    "owner_user_id" VARCHAR,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sf_crm_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_crm_deal_stages" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "pipeline_key" VARCHAR NOT NULL DEFAULT 'default',
    "name" VARCHAR NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sf_crm_deal_stages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_crm_deals" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "account_id" VARCHAR,
    "contact_id" VARCHAR,
    "stage_id" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "value" DECIMAL(18,2),
    "currency" VARCHAR(8) DEFAULT 'USD',
    "probability" SMALLINT,
    "expected_close_at" TIMESTAMPTZ(3),
    "owner_user_id" VARCHAR,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sf_crm_deals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_crm_activities" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "account_id" VARCHAR,
    "contact_id" VARCHAR,
    "deal_id" VARCHAR,
    "type" "SfCrmActivityType" NOT NULL,
    "subject" VARCHAR,
    "body" TEXT,
    "due_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_by_user_id" VARCHAR NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sf_crm_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_reminder_rules" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" "SfReminderRuleTrigger" NOT NULL,
    "cron_expression" VARCHAR,
    "timezone" VARCHAR(64),
    "config" JSONB NOT NULL DEFAULT '{}',
    "last_evaluated_at" TIMESTAMPTZ(3),
    "created_by_user_id" VARCHAR NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sf_reminder_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_reminders" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "user_id" VARCHAR NOT NULL,
    "title" VARCHAR NOT NULL,
    "body" TEXT,
    "fire_at" TIMESTAMPTZ(3) NOT NULL,
    "channel" "SfNotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "status" "SfReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "related_entity_type" VARCHAR,
    "related_entity_id" VARCHAR,
    "rule_id" VARCHAR,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sf_reminders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_reminder_runs" (
    "id" VARCHAR NOT NULL,
    "rule_id" VARCHAR NOT NULL,
    "dedupe_key" VARCHAR NOT NULL,
    "scheduled_for" TIMESTAMPTZ(3) NOT NULL,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sf_reminder_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_notification_deliveries" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "reminder_id" VARCHAR,
    "channel" "SfNotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "status" "SfNotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider_message_id" VARCHAR,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMPTZ(3),
    "error" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sf_notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sf_project_members_project_id_user_id_key" ON "sf_project_members" ("project_id", "user_id");

CREATE UNIQUE INDEX "sf_crm_deal_stages_workspace_id_pipeline_key_name_key" ON "sf_crm_deal_stages" ("workspace_id", "pipeline_key", "name");

CREATE UNIQUE INDEX "sf_reminder_runs_rule_id_dedupe_key_key" ON "sf_reminder_runs" ("rule_id", "dedupe_key");

CREATE INDEX "sf_projects_workspace_id_status_idx" ON "sf_projects" ("workspace_id", "status");

CREATE INDEX "sf_projects_workspace_id_sort_order_idx" ON "sf_projects" ("workspace_id", "sort_order");

CREATE INDEX "sf_project_members_user_id_idx" ON "sf_project_members" ("user_id");

CREATE INDEX "sf_tasks_project_id_status_idx" ON "sf_tasks" ("project_id", "status");

CREATE INDEX "sf_tasks_project_id_list_sort_order_idx" ON "sf_tasks" ("project_id", "list_sort_order");

CREATE INDEX "sf_tasks_assignee_user_id_idx" ON "sf_tasks" ("assignee_user_id");

CREATE INDEX "sf_tasks_due_at_idx" ON "sf_tasks" ("due_at");

CREATE INDEX "sf_task_comments_task_id_created_at_idx" ON "sf_task_comments" ("task_id", "created_at");

CREATE INDEX "sf_task_activities_task_id_created_at_idx" ON "sf_task_activities" ("task_id", "created_at");

CREATE INDEX "sf_crm_accounts_workspace_id_name_idx" ON "sf_crm_accounts" ("workspace_id", "name");

CREATE INDEX "sf_crm_accounts_owner_user_id_idx" ON "sf_crm_accounts" ("owner_user_id");

CREATE INDEX "sf_crm_contacts_workspace_id_last_name_first_name_idx" ON "sf_crm_contacts" ("workspace_id", "last_name", "first_name");

CREATE INDEX "sf_crm_contacts_account_id_idx" ON "sf_crm_contacts" ("account_id");

CREATE INDEX "sf_crm_contacts_email_idx" ON "sf_crm_contacts" ("email");

CREATE INDEX "sf_crm_deal_stages_workspace_id_pipeline_key_sort_order_idx" ON "sf_crm_deal_stages" ("workspace_id", "pipeline_key", "sort_order");

CREATE INDEX "sf_crm_deals_workspace_id_stage_id_idx" ON "sf_crm_deals" ("workspace_id", "stage_id");

CREATE INDEX "sf_crm_deals_account_id_idx" ON "sf_crm_deals" ("account_id");

CREATE INDEX "sf_crm_deals_contact_id_idx" ON "sf_crm_deals" ("contact_id");

CREATE INDEX "sf_crm_deals_owner_user_id_idx" ON "sf_crm_deals" ("owner_user_id");

CREATE INDEX "sf_crm_activities_workspace_id_due_at_idx" ON "sf_crm_activities" ("workspace_id", "due_at");

CREATE INDEX "sf_crm_activities_deal_id_idx" ON "sf_crm_activities" ("deal_id");

CREATE INDEX "sf_crm_activities_contact_id_idx" ON "sf_crm_activities" ("contact_id");

CREATE INDEX "sf_reminder_rules_workspace_id_enabled_idx" ON "sf_reminder_rules" ("workspace_id", "enabled");

CREATE INDEX "sf_reminders_workspace_id_fire_at_status_idx" ON "sf_reminders" ("workspace_id", "fire_at", "status");

CREATE INDEX "sf_reminders_user_id_fire_at_idx" ON "sf_reminders" ("user_id", "fire_at");

CREATE INDEX "sf_reminders_rule_id_idx" ON "sf_reminders" ("rule_id");

CREATE INDEX "sf_reminder_runs_rule_id_scheduled_for_idx" ON "sf_reminder_runs" ("rule_id", "scheduled_for");

CREATE INDEX "sf_notification_deliveries_workspace_id_status_created_at_idx" ON "sf_notification_deliveries" ("workspace_id", "status", "created_at");

CREATE INDEX "sf_notification_deliveries_reminder_id_idx" ON "sf_notification_deliveries" ("reminder_id");

ALTER TABLE "sf_projects" ADD CONSTRAINT "sf_projects_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_projects" ADD CONSTRAINT "sf_projects_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sf_project_members" ADD CONSTRAINT "sf_project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "sf_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_project_members" ADD CONSTRAINT "sf_project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_tasks" ADD CONSTRAINT "sf_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "sf_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_tasks" ADD CONSTRAINT "sf_tasks_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sf_tasks" ADD CONSTRAINT "sf_tasks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sf_task_comments" ADD CONSTRAINT "sf_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "sf_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_task_comments" ADD CONSTRAINT "sf_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_task_activities" ADD CONSTRAINT "sf_task_activities_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "sf_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_task_activities" ADD CONSTRAINT "sf_task_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sf_crm_accounts" ADD CONSTRAINT "sf_crm_accounts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_crm_accounts" ADD CONSTRAINT "sf_crm_accounts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sf_crm_contacts" ADD CONSTRAINT "sf_crm_contacts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_crm_contacts" ADD CONSTRAINT "sf_crm_contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "sf_crm_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sf_crm_contacts" ADD CONSTRAINT "sf_crm_contacts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sf_crm_deal_stages" ADD CONSTRAINT "sf_crm_deal_stages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_crm_deals" ADD CONSTRAINT "sf_crm_deals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_crm_deals" ADD CONSTRAINT "sf_crm_deals_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "sf_crm_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sf_crm_deals" ADD CONSTRAINT "sf_crm_deals_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sf_crm_contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sf_crm_deals" ADD CONSTRAINT "sf_crm_deals_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "sf_crm_deal_stages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sf_crm_deals" ADD CONSTRAINT "sf_crm_deals_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sf_crm_activities" ADD CONSTRAINT "sf_crm_activities_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_crm_activities" ADD CONSTRAINT "sf_crm_activities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "sf_crm_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sf_crm_activities" ADD CONSTRAINT "sf_crm_activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sf_crm_contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sf_crm_activities" ADD CONSTRAINT "sf_crm_activities_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "sf_crm_deals" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sf_crm_activities" ADD CONSTRAINT "sf_crm_activities_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_reminder_rules" ADD CONSTRAINT "sf_reminder_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_reminder_rules" ADD CONSTRAINT "sf_reminder_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_reminders" ADD CONSTRAINT "sf_reminders_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_reminders" ADD CONSTRAINT "sf_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_reminders" ADD CONSTRAINT "sf_reminders_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "sf_reminder_rules" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sf_reminder_runs" ADD CONSTRAINT "sf_reminder_runs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "sf_reminder_rules" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_notification_deliveries" ADD CONSTRAINT "sf_notification_deliveries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sf_notification_deliveries" ADD CONSTRAINT "sf_notification_deliveries_reminder_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "sf_reminders" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
