import { PrismaClient } from '@prisma/client';

/**
 * Analytics Platform — Phase 1 schema (docs/analytics-platform.md §5).
 *
 * Adds:
 *   - enums: SocialPlatform, ConnectionStatus, MetricBucket, InsightType, InsightSeverity
 *   - tables: social_connections, social_events, social_metrics, social_insights,
 *             social_ai_budget, social_audit_logs
 *
 * Per CLAUDE.md §4 "live deploy hygiene", this migration is idempotent:
 * every CREATE/ALTER/INDEX uses IF NOT EXISTS and is safely re-runnable.
 *
 * Out-of-band: `prisma migrate deploy` is the primary path for the schema.
 * This data-migration file exists to backstop fresh installs and to make
 * the analytics tables resilient against drift between the bundled Prisma
 * schema and the live database (e.g. partial deploys, rollbacks).
 */
export class AnalyticsPlatform1746345600000 {
  static async up(db: PrismaClient) {
    // ---------------------------------------------------------------------
    // Enums (idempotent via DO block — Postgres has no native CREATE TYPE
    // IF NOT EXISTS for enums)
    // ---------------------------------------------------------------------
    const enums: Array<{ name: string; values: readonly string[] }> = [
      {
        name: 'SocialPlatform',
        values: [
          'FACEBOOK',
          'INSTAGRAM',
          'THREADS',
          'TIKTOK',
          'LINE_VOOM',
          'GOGOCASH',
        ],
      },
      {
        name: 'ConnectionStatus',
        values: ['ACTIVE', 'PAUSED', 'EXPIRED', 'ERROR'],
      },
      { name: 'MetricBucket', values: ['HOUR', 'DAY', 'WEEK'] },
      {
        name: 'InsightType',
        values: ['WEEKLY_STRATEGY', 'TREND', 'ANOMALY', 'RECOMMENDATION'],
      },
      {
        name: 'InsightSeverity',
        values: ['INFO', 'NOTABLE', 'ACTION_REQUIRED'],
      },
    ];

    for (const e of enums) {
      const valuesSql = e.values.map(v => `'${v}'`).join(', ');
      await db.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${e.name}') THEN
            CREATE TYPE "${e.name}" AS ENUM (${valuesSql});
          END IF;
        END
        $$;
      `);
    }

    // ---------------------------------------------------------------------
    // Tables
    // ---------------------------------------------------------------------
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "social_connections" (
        "id" VARCHAR PRIMARY KEY,
        "workspace_id" VARCHAR NOT NULL,
        "platform" "SocialPlatform" NOT NULL,
        "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
        "access_token_enc" TEXT NOT NULL,
        "refresh_token_enc" TEXT,
        "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        "external_account_id" VARCHAR NOT NULL,
        "external_account_name" VARCHAR NOT NULL,
        "connected_by_user_id" VARCHAR NOT NULL,
        "expires_at" TIMESTAMPTZ(3),
        "last_sync_at" TIMESTAMPTZ(3),
        "last_error_at" TIMESTAMPTZ(3),
        "last_error" TEXT,
        "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
      );
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "social_events" (
        "id" VARCHAR PRIMARY KEY,
        "workspace_id" VARCHAR NOT NULL,
        "connection_id" VARCHAR NOT NULL,
        "platform" "SocialPlatform" NOT NULL,
        "event_type" VARCHAR NOT NULL,
        "external_id" VARCHAR NOT NULL,
        "occurred_at" TIMESTAMPTZ(3) NOT NULL,
        "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
        "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "raw" JSONB NOT NULL DEFAULT '{}'::jsonb
      );
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "social_metrics" (
        "id" VARCHAR PRIMARY KEY,
        "workspace_id" VARCHAR NOT NULL,
        "platform" "SocialPlatform" NOT NULL,
        "metric_key" VARCHAR NOT NULL,
        "bucket" "MetricBucket" NOT NULL,
        "bucket_start" TIMESTAMPTZ(3) NOT NULL,
        "value" DOUBLE PRECISION NOT NULL,
        "metadata" JSONB
      );
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "social_insights" (
        "id" VARCHAR PRIMARY KEY,
        "workspace_id" VARCHAR NOT NULL,
        "insight_type" "InsightType" NOT NULL,
        "platforms" "SocialPlatform"[] NOT NULL DEFAULT ARRAY[]::"SocialPlatform"[],
        "title" VARCHAR NOT NULL,
        "body" TEXT NOT NULL,
        "severity" "InsightSeverity" NOT NULL,
        "model_used" VARCHAR NOT NULL,
        "cost_usd" DOUBLE PRECISION NOT NULL,
        "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
        "acknowledged_at" TIMESTAMPTZ(3),
        "acknowledged_by_id" VARCHAR
      );
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "social_ai_budget" (
        "id" VARCHAR PRIMARY KEY,
        "workspace_id" VARCHAR NOT NULL,
        "month_year" VARCHAR NOT NULL,
        "spent_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "cap_usd" DOUBLE PRECISION NOT NULL DEFAULT 100,
        "alert_sent" BOOLEAN NOT NULL DEFAULT false
      );
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "social_audit_logs" (
        "id" VARCHAR PRIMARY KEY,
        "workspace_id" VARCHAR NOT NULL,
        "user_id" VARCHAR,
        "platform" "SocialPlatform" NOT NULL,
        "action" VARCHAR NOT NULL,
        "request_id" VARCHAR,
        "metadata" JSONB,
        "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
      );
    `);

    // ---------------------------------------------------------------------
    // Foreign keys (idempotent — pg_constraint check)
    // ---------------------------------------------------------------------
    const foreignKeys: Array<{
      name: string;
      table: string;
      column: string;
      refTable: string;
      refColumn: string;
      onDelete: 'CASCADE' | 'RESTRICT' | 'NO ACTION';
    }> = [
      {
        name: 'social_connections_workspace_id_fkey',
        table: 'social_connections',
        column: 'workspace_id',
        refTable: 'workspaces',
        refColumn: 'id',
        onDelete: 'CASCADE',
      },
      {
        name: 'social_connections_connected_by_user_id_fkey',
        table: 'social_connections',
        column: 'connected_by_user_id',
        refTable: 'users',
        refColumn: 'id',
        onDelete: 'NO ACTION',
      },
    ];

    for (const fk of foreignKeys) {
      await db.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = '${fk.name}'
          ) THEN
            ALTER TABLE "${fk.table}"
              ADD CONSTRAINT "${fk.name}"
              FOREIGN KEY ("${fk.column}")
              REFERENCES "${fk.refTable}"("${fk.refColumn}")
              ON DELETE ${fk.onDelete}
              ON UPDATE CASCADE;
          END IF;
        END
        $$;
      `);
    }

    // ---------------------------------------------------------------------
    // Indexes (CREATE INDEX IF NOT EXISTS is supported natively)
    // ---------------------------------------------------------------------
    const indexes: Array<{ name: string; sql: string }> = [
      {
        name: 'social_connections_workspace_id_platform_external_account_id_key',
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS "social_connections_workspace_id_platform_external_account_id_key" ON "social_connections" ("workspace_id", "platform", "external_account_id")`,
      },
      {
        name: 'social_connections_workspace_id_idx',
        sql: `CREATE INDEX IF NOT EXISTS "social_connections_workspace_id_idx" ON "social_connections" ("workspace_id")`,
      },
      {
        name: 'social_connections_status_expires_at_idx',
        sql: `CREATE INDEX IF NOT EXISTS "social_connections_status_expires_at_idx" ON "social_connections" ("status", "expires_at")`,
      },
      {
        name: 'social_events_connection_id_external_id_event_type_key',
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS "social_events_connection_id_external_id_event_type_key" ON "social_events" ("connection_id", "external_id", "event_type")`,
      },
      {
        name: 'social_events_workspace_id_occurred_at_idx',
        sql: `CREATE INDEX IF NOT EXISTS "social_events_workspace_id_occurred_at_idx" ON "social_events" ("workspace_id", "occurred_at")`,
      },
      {
        name: 'social_events_workspace_id_platform_event_type_occurred_at_idx',
        sql: `CREATE INDEX IF NOT EXISTS "social_events_workspace_id_platform_event_type_occurred_at_idx" ON "social_events" ("workspace_id", "platform", "event_type", "occurred_at")`,
      },
      {
        name: 'social_metrics_unique_key',
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS "social_metrics_unique_key" ON "social_metrics" ("workspace_id", "platform", "metric_key", "bucket", "bucket_start")`,
      },
      {
        name: 'social_metrics_lookup_idx',
        sql: `CREATE INDEX IF NOT EXISTS "social_metrics_lookup_idx" ON "social_metrics" ("workspace_id", "platform", "bucket", "bucket_start")`,
      },
      {
        name: 'social_insights_workspace_id_created_at_idx',
        sql: `CREATE INDEX IF NOT EXISTS "social_insights_workspace_id_created_at_idx" ON "social_insights" ("workspace_id", "created_at")`,
      },
      {
        name: 'social_insights_workspace_id_insight_type_created_at_idx',
        sql: `CREATE INDEX IF NOT EXISTS "social_insights_workspace_id_insight_type_created_at_idx" ON "social_insights" ("workspace_id", "insight_type", "created_at")`,
      },
      {
        name: 'social_ai_budget_workspace_id_month_year_key',
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS "social_ai_budget_workspace_id_month_year_key" ON "social_ai_budget" ("workspace_id", "month_year")`,
      },
      {
        name: 'social_audit_logs_workspace_id_created_at_idx',
        sql: `CREATE INDEX IF NOT EXISTS "social_audit_logs_workspace_id_created_at_idx" ON "social_audit_logs" ("workspace_id", "created_at")`,
      },
      {
        name: 'social_audit_logs_user_id_created_at_idx',
        sql: `CREATE INDEX IF NOT EXISTS "social_audit_logs_user_id_created_at_idx" ON "social_audit_logs" ("user_id", "created_at")`,
      },
    ];

    for (const idx of indexes) {
      await db.$executeRawUnsafe(idx.sql);
    }
  }

  // Down is intentionally empty. Per docs/analytics-platform.md §11 "DB rollback":
  // all social_* tables are additive — drop happens via a follow-up migration
  // with explicit DROP TABLE IF EXISTS only when we deliberately retire the
  // feature. Auto-rollback is not appropriate here.
  static async down(_db: PrismaClient) {}
}
