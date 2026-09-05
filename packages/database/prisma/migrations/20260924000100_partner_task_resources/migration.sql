-- Marketing CRM: file / link attachments on partner task cards.
-- Idempotent so a partial-apply re-run is safe.
CREATE TABLE IF NOT EXISTS "partner_task_resources" (
  "id"         uuid NOT NULL DEFAULT gen_random_uuid(),
  "task_id"    uuid NOT NULL,
  "kind"       text NOT NULL,
  "label"      text NOT NULL,
  "url"        text NOT NULL,
  "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" uuid NOT NULL,
  CONSTRAINT "partner_task_resources_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "partner_task_resources_task_id_idx"
  ON "partner_task_resources" ("task_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partner_task_resources_task_id_fkey'
  ) THEN
    ALTER TABLE "partner_task_resources"
      ADD CONSTRAINT "partner_task_resources_task_id_fkey"
      FOREIGN KEY ("task_id") REFERENCES "partner_tasks"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
