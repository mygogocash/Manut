-- OneWave holistic dashboard (2026-06-11): normalized daily metrics
-- (per date×telco) + computed snapshot. Written by the
-- /api/cron/ow-snapshot-refresh job from the multi-tab OW2.0 sheet.
-- Idempotent (CLAUDE.md): safe to re-run.

CREATE TABLE IF NOT EXISTS "ow_daily_metrics" (
  "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
  "date"               DATE NOT NULL,
  "telco"              VARCHAR(20) NOT NULL,
  "homepage_views"     INTEGER,
  "dau_crm"            INTEGER,
  "dau_ga"             INTEGER,
  "mau_rolling_30"     INTEGER,
  "unique_users"       INTEGER,
  "new_users"          INTEGER,
  "repeat_users"       INTEGER,
  "avg_session_sec"    INTEGER,
  "stw_wins"           INTEGER,
  "clicks_bnry_games"  INTEGER,
  "access_pass_users"  INTEGER,
  "bnry_earned"        INTEGER,
  "bnry_redeemed"      INTEGER,
  "is_anomaly"         BOOLEAN NOT NULL DEFAULT false,
  "is_intraday"        BOOLEAN NOT NULL DEFAULT false,
  "source_tab"         VARCHAR(120),
  "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ow_daily_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ow_daily_metrics_date_telco_key"
  ON "ow_daily_metrics" ("date", "telco");
CREATE INDEX IF NOT EXISTS "ow_daily_metrics_telco_date_idx"
  ON "ow_daily_metrics" ("telco", "date");

CREATE TABLE IF NOT EXISTS "ow_snapshots" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "payload"      JSONB NOT NULL,
  "narrative"    JSONB,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ow_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ow_snapshots_generated_at_idx"
  ON "ow_snapshots" ("generated_at" DESC);
