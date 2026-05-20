-- MongoDB ingestion-config tables — Manut analytics Wave 2 / M3 E3.4.
--
-- Three tables back the connected-MongoDB → cherry-pick → schedule
-- ingestion pipeline. The user connects a Mongo URI via the existing
-- `mongodb-connection` plugin (AES-encrypted in IntegrationConnection),
-- then picks which collections to mirror via the new ingestion-config
-- resolver. The resolver writes rows into `mn_mongo_ingestion_config`;
-- the ingestion cron reads enabled rows, pulls
-- documents into `mn_mongo_raw_data`, and rolls per-day aggregates
-- into `mn_analytics_daily_stats`.
--
-- All DDL is idempotent (IF NOT EXISTS on tables + indexes) so a
-- replay is safe — matches the pattern used by
-- 20260519140000_add_social_analytics_tables/migration.sql and is
-- mandated by CLAUDE.md §1 Honesty R0 ("Migration IF NOT EXISTS").
--
-- Schema notes:
--   - `mn_mongo_ingestion_config` is the human-curated picker: one row
--     per (workspace, collection) the user has opted in. `mappings` is
--     a free-form JSONB for future field-aliasing without a schema
--     change.
--   - `mn_mongo_raw_data` is the landing zone. Composite PK keys on
--     (workspace, collection, doc_id) so re-ingesting the same Mongo
--     doc upserts cleanly. JSONB payload mirrors the source document.
--   - `mn_analytics_daily_stats` is the rolled-up metric grain — one
--     row per (workspace, day, metric) — that the analytics dashboards
--     read. The worker writes to this; ingestion-config does not.

-- CreateTable
CREATE TABLE IF NOT EXISTS "mn_mongo_ingestion_config" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "collection_name" VARCHAR NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cursor_field" VARCHAR NOT NULL DEFAULT 'updatedAt',
    "mappings" JSONB NOT NULL DEFAULT '{}',
    "last_synced_at" TIMESTAMPTZ(3),
    "last_cursor_value" VARCHAR,
    -- Circuit breaker / error surfaces consumed by MongoDbIngestionService.
    -- Tracked here (not as a separate table) so a single UPDATE on success
    -- / failure handles both cursor advance and breaker state.
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR,
    "last_error_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mn_mongo_ingestion_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "mn_mongo_raw_data" (
    "workspace_id" VARCHAR NOT NULL,
    "collection_name" VARCHAR NOT NULL,
    "doc_id" VARCHAR NOT NULL,
    "payload" JSONB NOT NULL,
    "ingested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mn_mongo_raw_data_pkey" PRIMARY KEY ("workspace_id", "collection_name", "doc_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "mn_analytics_daily_stats" (
    "workspace_id" VARCHAR NOT NULL,
    "day" DATE NOT NULL,
    "metric" VARCHAR NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "mn_analytics_daily_stats_pkey" PRIMARY KEY ("workspace_id", "day", "metric")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "mn_mongo_ingestion_config_workspace_id_collection_name_key" ON "mn_mongo_ingestion_config"("workspace_id", "collection_name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mn_mongo_raw_data_workspace_id_collection_name_ingested_at_idx" ON "mn_mongo_raw_data"("workspace_id", "collection_name", "ingested_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mn_analytics_daily_stats_workspace_id_metric_day_idx" ON "mn_analytics_daily_stats"("workspace_id", "metric", "day");
