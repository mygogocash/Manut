-- Visa Timeline (2026-06-12): per-record event log + a status-change
-- timestamp on visa_records. Idempotent (CLAUDE.md): safe to re-run.

ALTER TABLE "visa_records"
  ADD COLUMN IF NOT EXISTS "status_changed_at" TIMESTAMP(3);

-- Backfill existing rows so the stamp isn't null forever; created_at is the
-- best available proxy for "when the current status was set". Idempotent:
-- only touches rows still missing the value.
UPDATE "visa_records"
SET "status_changed_at" = "created_at"
WHERE "status_changed_at" IS NULL;

CREATE TABLE IF NOT EXISTS "visa_event_logs" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "visa_record_id" UUID         NOT NULL,
  "actor_id"       UUID,
  "actor_type"     TEXT         NOT NULL DEFAULT 'user',
  "kind"           TEXT         NOT NULL,
  "field"          TEXT,
  "old_value"      TEXT,
  "new_value"      TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "visa_event_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "visa_event_logs_visa_record_id_fkey"
    FOREIGN KEY ("visa_record_id") REFERENCES "visa_records" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "visa_event_logs_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "visa_event_logs_visa_record_id_created_at_idx"
  ON "visa_event_logs" ("visa_record_id", "created_at");
