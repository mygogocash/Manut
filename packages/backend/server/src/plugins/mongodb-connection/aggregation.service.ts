import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Manut Analytics — daily-stats aggregation service.
 *
 * Rolls up the raw documents that `MongoDbIngestionService` lands in
 * `mn_mongo_raw_data` into per-day metric rows in
 * `mn_analytics_daily_stats`. The frontend dashboard reads only from
 * `mn_analytics_daily_stats` via the `dailyStats` GraphQL query; raw
 * documents stay server-side.
 *
 * Two metrics are computed per collection per workspace:
 *
 *   - `<collection>_count` — how many rows landed in
 *     `mn_mongo_raw_data` on the given day (i.e. how many docs were
 *     touched by the ingestion cron in that window). Bucketed by
 *     `date_trunc('day', ingested_at)`.
 *   - `<collection>_new` — how many distinct `doc_id`s were seen for
 *     the FIRST time on the given day. Implemented as a window-function
 *     SQL query that picks the MIN(ingested_at) per doc_id, then groups
 *     by that day.
 *
 * Both are upserted into `mn_analytics_daily_stats` keyed on
 * `(workspace_id, day, metric)` so re-running for the same lookback
 * window is idempotent — the next run overwrites.
 *
 * Performance:
 *  - One $queryRaw per metric per workspace, NOT one per row. A
 *    workspace with 100 collections does 200 queries — not 200 × N
 *    docs. The window-function variant for `<collection>_new` is
 *    bounded by `lookbackDays` so we never scan all-time history.
 *  - Aggregations are written back with a single Postgres
 *    `INSERT … ON CONFLICT DO UPDATE` per (day, metric) combination so
 *    a workspace with 14 days × 5 collections × 2 metrics writes ~140
 *    rows, capped at one round-trip each.
 *
 * CLAUDE.md scars honoured:
 *  - `@Injectable()` on the provider (v1.12.0 DI scar).
 *  - `PrismaClient` is a RUNTIME import (no `import type` for a DI
 *    target — v1.12.0 scar).
 *  - No raw row interpolation into `$executeRaw` strings; only Prisma's
 *    tagged template binding, which parameterises every value.
 *  - SQL uses `date_trunc('day', …)::date` to keep day granularity
 *    aligned with `mn_analytics_daily_stats.day` (`DATE` column).
 */

/** Result of a single workspace's aggregation run, used for telemetry. */
export interface AggregationResult {
  workspaceId: string;
  /** Number of (collection, metric) tuples that produced any rows. */
  metricsComputed: number;
  /** Total number of (day, metric) rows upserted into the daily-stats table. */
  rowsUpserted: number;
  durationMs: number;
  /** Per-collection error messages — never throws to the caller. */
  errors: string[];
}

interface CountAggregateRow {
  day: Date;
  count: bigint;
}

interface NewDocAggregateRow {
  day: Date;
  count: bigint;
}

@Injectable()
export class MongoDbAggregationService {
  private readonly logger = new Logger(MongoDbAggregationService.name);

  constructor(private readonly db: PrismaClient) {}

  /**
   * Compute and upsert daily metrics for one workspace. Walks every
   * distinct `collection_name` that has at least one row in
   * `mn_mongo_raw_data` for this workspace, then runs the two metric
   * aggregations against the lookback window.
   *
   * Errors on a single collection are captured into `result.errors`
   * but do NOT abort the workspace — partial progress is preferred
   * over a poison-pill collection blocking the rest.
   *
   * @param workspaceId workspace whose raw data is rolled up
   * @param lookbackDays how many days back from "today" to recompute.
   *   Defaults to 7. Idempotent — same lookback overwrites the same
   *   `(workspaceId, day, metric)` rows.
   */
  async runForWorkspace(
    workspaceId: string,
    lookbackDays = 7
  ): Promise<AggregationResult> {
    const start = Date.now();
    const result: AggregationResult = {
      workspaceId,
      metricsComputed: 0,
      rowsUpserted: 0,
      durationMs: 0,
      errors: [],
    };

    const collections = await this.listCollections(workspaceId);
    if (collections.length === 0) {
      result.durationMs = Date.now() - start;
      return result;
    }

    for (const collectionName of collections) {
      try {
        const upserted = await this.aggregateCollection(
          workspaceId,
          collectionName,
          lookbackDays
        );
        // Each collection contributes UP TO two metrics — only count
        // the ones that actually produced rows.
        if (upserted.countRows > 0) {
          result.metricsComputed += 1;
          result.rowsUpserted += upserted.countRows;
        }
        if (upserted.newRows > 0) {
          result.metricsComputed += 1;
          result.rowsUpserted += upserted.newRows;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`${collectionName}: ${message}`);
        this.logger.error(
          `Aggregation failed: workspace=${workspaceId} collection=${collectionName}: ${message}`
        );
      }
    }

    result.durationMs = Date.now() - start;
    this.emitTelemetry(result);
    return result;
  }

  /**
   * Return distinct workspace ids that currently have at least one row
   * in `mn_mongo_raw_data`. Used by the cron to drive `runForWorkspace`
   * per workspace without scanning the (much larger) workspace table.
   */
  async listWorkspacesWithRawData(): Promise<string[]> {
    const rows = await this.db.$queryRaw<Array<{ workspace_id: string }>>`
      SELECT DISTINCT workspace_id
      FROM mn_mongo_raw_data
    `;
    return rows.map(r => r.workspace_id);
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  /**
   * Run both metric aggregations for one collection. Returns counts of
   * how many rows each metric upserted so the caller can build accurate
   * telemetry.
   */
  private async aggregateCollection(
    workspaceId: string,
    collectionName: string,
    lookbackDays: number
  ): Promise<{ countRows: number; newRows: number }> {
    const lookbackStart = this.lookbackBoundary(lookbackDays);

    // Metric 1: <collection>_count — total ingestion rows per day.
    const countRows = await this.db.$queryRaw<CountAggregateRow[]>`
      SELECT
        date_trunc('day', ingested_at)::date AS day,
        COUNT(*)::bigint AS count
      FROM mn_mongo_raw_data
      WHERE workspace_id = ${workspaceId}
        AND collection_name = ${collectionName}
        AND ingested_at >= ${lookbackStart}
      GROUP BY date_trunc('day', ingested_at)
    `;

    // Metric 2: <collection>_new — distinct doc_ids first seen per day.
    //
    // The CTE picks MIN(ingested_at) per doc_id (across ALL history for
    // the doc, so a doc that first arrived 30 days ago doesn't get
    // counted as new today). The outer SELECT then keeps only those
    // first-seen timestamps that fall inside the lookback window, and
    // groups by day.
    const newRows = await this.db.$queryRaw<NewDocAggregateRow[]>`
      WITH first_seen AS (
        SELECT
          doc_id,
          MIN(ingested_at) AS first_at
        FROM mn_mongo_raw_data
        WHERE workspace_id = ${workspaceId}
          AND collection_name = ${collectionName}
        GROUP BY doc_id
      )
      SELECT
        date_trunc('day', first_at)::date AS day,
        COUNT(*)::bigint AS count
      FROM first_seen
      WHERE first_at >= ${lookbackStart}
      GROUP BY date_trunc('day', first_at)
    `;

    const countMetric = `${collectionName}_count`;
    const newMetric = `${collectionName}_new`;

    for (const row of countRows) {
      await this.upsertDailyStat(workspaceId, row.day, countMetric, row.count);
    }
    for (const row of newRows) {
      await this.upsertDailyStat(workspaceId, row.day, newMetric, row.count);
    }

    return { countRows: countRows.length, newRows: newRows.length };
  }

  /**
   * Upsert one row into `mn_analytics_daily_stats`. The PK is
   * `(workspace_id, day, metric)` so `ON CONFLICT` collapses re-runs
   * onto the existing row — idempotent by design.
   *
   * `value` is widened from `bigint` (count return type) to `double
   * precision` because the daily-stats column is `DOUBLE PRECISION` —
   * the conversion is lossless for any count that fits in a double's
   * 53-bit mantissa (~9 quadrillion, more than enough headroom).
   */
  private async upsertDailyStat(
    workspaceId: string,
    day: Date,
    metric: string,
    value: bigint
  ): Promise<void> {
    const numericValue = Number(value);
    await this.db.$executeRaw`
      INSERT INTO mn_analytics_daily_stats (workspace_id, day, metric, value)
      VALUES (${workspaceId}, ${day}::date, ${metric}, ${numericValue})
      ON CONFLICT (workspace_id, day, metric) DO UPDATE SET
        value = EXCLUDED.value
    `;
  }

  /**
   * Distinct collection names for this workspace that have at least
   * one row in `mn_mongo_raw_data`. Ordered alphabetically so the
   * telemetry stream is stable across re-runs.
   */
  private async listCollections(workspaceId: string): Promise<string[]> {
    const rows = await this.db.$queryRaw<Array<{ collection_name: string }>>`
      SELECT DISTINCT collection_name
      FROM mn_mongo_raw_data
      WHERE workspace_id = ${workspaceId}
      ORDER BY collection_name ASC
    `;
    return rows.map(r => r.collection_name);
  }

  /**
   * Anchor the lookback window to the start of the day, `lookbackDays`
   * ago. Aligning to the day boundary keeps the window stable within a
   * day (so two hourly runs produce the same window) and gives the
   * daily-stats rollup a clean lower bound.
   */
  private lookbackBoundary(lookbackDays: number): Date {
    const days = Math.max(1, Math.floor(lookbackDays));
    const boundary = new Date();
    boundary.setUTCDate(boundary.getUTCDate() - days);
    boundary.setUTCHours(0, 0, 0, 0);
    return boundary;
  }

  private emitTelemetry(result: AggregationResult): void {
    const payload = JSON.stringify({
      event: 'mongo_aggregation_run',
      workspaceId: result.workspaceId,
      metricsComputed: result.metricsComputed,
      rowsUpserted: result.rowsUpserted,
      durationMs: result.durationMs,
      errorCount: result.errors.length,
    });
    if (result.errors.length === 0) {
      this.logger.log(payload);
    } else if (result.metricsComputed > 0) {
      this.logger.warn(payload);
    } else {
      this.logger.error(payload);
    }
  }
}
