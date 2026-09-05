-- Daily snapshot of Supabase Storage usage per bucket. Idempotent on the
-- table; idempotent on the indexes via IF NOT EXISTS so re-runs after a
-- partial-apply incident still succeed.

CREATE TABLE IF NOT EXISTS "storage_snapshots" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "bucket"       VARCHAR(100) NOT NULL,
    "bytes"        BIGINT NOT NULL,
    "object_count" INTEGER NOT NULL,
    "captured_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "storage_snapshots_captured_at_idx"
    ON "storage_snapshots" ("captured_at" DESC);

CREATE INDEX IF NOT EXISTS "storage_snapshots_bucket_captured_at_idx"
    ON "storage_snapshots" ("bucket", "captured_at" DESC);
