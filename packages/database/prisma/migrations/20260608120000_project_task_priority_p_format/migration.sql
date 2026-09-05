-- Project tasks: replace low|medium|high|urgent|critical with P0|P1|P2.

UPDATE "project_tasks"
SET "priority" = 'P0'
WHERE "priority" IN ('critical', 'urgent', 'high');

UPDATE "project_tasks"
SET "priority" = 'P1'
WHERE "priority" = 'medium';

UPDATE "project_tasks"
SET "priority" = 'P2'
WHERE "priority" = 'low';

UPDATE "project_tasks"
SET "priority" = 'P1'
WHERE "priority" NOT IN ('P0', 'P1', 'P2');

ALTER TABLE "project_tasks"
  ALTER COLUMN "priority" SET DEFAULT 'P1';
