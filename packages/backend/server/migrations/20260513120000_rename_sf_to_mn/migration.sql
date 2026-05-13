-- Manut rebrand: rename Superflow (sf_*) tables and types to Manut (mn_*).
--
-- ALTER TABLE RENAME and ALTER TYPE RENAME in PostgreSQL are metadata-only
-- (no data move), atomic, and wrapped by Prisma's migration runner in a
-- single transaction. Foreign key constraints reference tables by OID so
-- they keep working after the rename. Indexes and sequences whose names
-- contain the old table name are auto-renamed by Postgres.
--
-- The corresponding Prisma model + enum rename is in schema.prisma
-- (model SfX → MnX, enum SfX → MnX, @@map("sf_*") → @@map("mn_*")).
--
-- Rollback (R0 — last resort, requires manual SQL):
--   ALTER TABLE mn_projects RENAME TO sf_projects;
--   ... (and so on for every renamed table + type)

-- =========================
-- Tables (14)
-- =========================
ALTER TABLE "sf_projects" RENAME TO "mn_projects";
ALTER TABLE "sf_project_members" RENAME TO "mn_project_members";
ALTER TABLE "sf_tasks" RENAME TO "mn_tasks";
ALTER TABLE "sf_task_comments" RENAME TO "mn_task_comments";
ALTER TABLE "sf_task_activities" RENAME TO "mn_task_activities";
ALTER TABLE "sf_crm_accounts" RENAME TO "mn_crm_accounts";
ALTER TABLE "sf_crm_contacts" RENAME TO "mn_crm_contacts";
ALTER TABLE "sf_crm_deal_stages" RENAME TO "mn_crm_deal_stages";
ALTER TABLE "sf_crm_deals" RENAME TO "mn_crm_deals";
ALTER TABLE "sf_crm_activities" RENAME TO "mn_crm_activities";
ALTER TABLE "sf_reminders" RENAME TO "mn_reminders";
ALTER TABLE "sf_reminder_rules" RENAME TO "mn_reminder_rules";
ALTER TABLE "sf_reminder_runs" RENAME TO "mn_reminder_runs";
ALTER TABLE "sf_notification_deliveries" RENAME TO "mn_notification_deliveries";

-- =========================
-- Enums (8)
-- =========================
ALTER TYPE "SfProjectStatus" RENAME TO "MnProjectStatus";
ALTER TYPE "SfTaskStatus" RENAME TO "MnTaskStatus";
ALTER TYPE "SfTaskPriority" RENAME TO "MnTaskPriority";
ALTER TYPE "SfCrmActivityType" RENAME TO "MnCrmActivityType";
ALTER TYPE "SfReminderStatus" RENAME TO "MnReminderStatus";
ALTER TYPE "SfReminderRuleTrigger" RENAME TO "MnReminderRuleTrigger";
ALTER TYPE "SfNotificationChannel" RENAME TO "MnNotificationChannel";
ALTER TYPE "SfNotificationDeliveryStatus" RENAME TO "MnNotificationDeliveryStatus";
