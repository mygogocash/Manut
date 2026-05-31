import { Injectable, Logger } from '@nestjs/common';
import {
  Args,
  Field,
  Float,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { PrismaClient } from '@prisma/client';

import { AuthenticationRequired, BadRequest } from '../../base';
import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import { MongoDbAggregationService } from './aggregation.service';

// ============================================================================
// ObjectTypes / InputTypes
//
// Every nullable @Field has an explicit `() => Type` parameter — see
// CLAUDE.md §6 (the `UndefinedTypeError` scar that's shipped TWICE).
// NestJS metadata reflection cannot infer a GraphQL type from any
// nullable / union TypeScript type; the decorator IS the source of
// truth for the schema.
// ============================================================================

@ObjectType('DailyStat')
export class DailyStatType {
  /**
   * Day in `YYYY-MM-DD` format. We surface a string (not Date) because
   * the Postgres `DATE` column stores a calendar day with no time/zone
   * — passing it back through `GraphQLISODateTime` would attach an
   * arbitrary `00:00:00.000Z` suffix that the frontend would then
   * have to strip. String is the honest wire format here.
   */
  @Field(() => String)
  day!: string;

  @Field(() => String)
  metric!: string;

  @Field(() => Float)
  value!: number;
}

@InputType('DailyStatsInput')
export class DailyStatsInputType {
  @Field(() => String)
  workspaceId!: string;

  /**
   * Optional metric filter. When omitted or empty, the resolver
   * returns every metric in the (from, to) window. When provided, it
   * filters with `metric IN (…)`.
   */
  @Field(() => [String], { nullable: true })
  metrics?: string[];

  /** Inclusive lower bound, `YYYY-MM-DD`. */
  @Field(() => String)
  from!: string;

  /** Inclusive upper bound, `YYYY-MM-DD`. */
  @Field(() => String)
  to!: string;
}

interface DailyStatRow {
  day: Date;
  metric: string;
  value: number;
}

/**
 * Manut Analytics — GraphQL surface for the daily-stats roll-up.
 *
 * One Query (`dailyStats`) and one Mutation (`backfillAnalytics`):
 *  - `dailyStats` is what the dashboard reads. It's a thin filter
 *    over `mn_analytics_daily_stats` — no joins, no business logic.
 *  - `backfillAnalytics` is an admin-recovery handle for the case
 *    where someone needs to re-roll a window (e.g. after fixing a
 *    bad raw row by hand). It delegates to
 *    `MongoDbAggregationService.runForWorkspace`.
 *
 * Permission model:
 *  - `dailyStats` requires `Workspace.Read` (any workspace member can
 *    view).
 *  - `backfillAnalytics` requires `Workspace.Settings.Update`
 *    (workspace admins only). Backfill is mutative + expensive, so
 *    the higher gate matches the typical "configuration change"
 *    permission elsewhere in the app.
 *
 * CLAUDE.md scars honoured:
 *  - `@Injectable()` on the resolver class (v1.12.0 scar — required
 *    for NestJS DI to resolve constructor parameters).
 *  - `AccessController` is a RUNTIME import (no `import type` for a
 *    DI target — v1.12.0 scar).
 *  - `MongoDbAggregationService` likewise — runtime import.
 *  - Nullable `@Field` annotations use explicit `() => Type` — see
 *    `metrics?: string[]` above.
 */
@Injectable()
@Resolver()
export class AnalyticsResolver {
  private readonly logger = new Logger(AnalyticsResolver.name);

  constructor(
    private readonly aggregation: MongoDbAggregationService,
    private readonly ac: AccessController,
    // PrismaClient injected via DI. Querying `mn_analytics_daily_stats`
    // lives here (in the resolver) rather than the aggregation service
    // because the aggregation service is the WRITER of these rows and
    // the resolver is the READER with the auth context. Splitting
    // reader from writer keeps the surface narrow per CLAUDE.md §2.4.
    //
    // NOTE: PrismaClient is a RUNTIME import at the top of the file,
    // NOT `import type` — the v1.12.0 DI scar (see CLAUDE.md §6 NestJS
    // DI metadata traps) means `import type` on a DI target erases the
    // emitted `design:paramtypes` metadata and breaks injection.
    private readonly db: PrismaClient
  ) {}

  /**
   * Return the matching daily-stats rows. The filter is composed at
   * the SQL layer so we never load the workspace's whole history into
   * memory just to slice it client-side.
   */
  @Query(() => [DailyStatType])
  async dailyStats(
    @CurrentUser() user: CurrentUser | null,
    @Args('input') input: DailyStatsInputType
  ): Promise<DailyStatType[]> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac
      .user(user.id)
      .workspace(input.workspaceId)
      .assert('Workspace.Read');

    const from = this.parseDay(input.from, 'from');
    const to = this.parseDay(input.to, 'to');
    if (from > to) {
      // Friendly typed error (UserFriendlyError) — finding #13.
      throw new BadRequest('`from` must be on or before `to`.');
    }

    const metricsFilter = (input.metrics ?? []).filter(m => m.length > 0);
    const rows =
      metricsFilter.length > 0
        ? await this.db.$queryRaw<DailyStatRow[]>`
          SELECT day, metric, value
          FROM mn_analytics_daily_stats
          WHERE workspace_id = ${input.workspaceId}
            AND day BETWEEN ${from}::date AND ${to}::date
            AND metric = ANY(${metricsFilter}::varchar[])
          ORDER BY day ASC, metric ASC
        `
        : await this.db.$queryRaw<DailyStatRow[]>`
          SELECT day, metric, value
          FROM mn_analytics_daily_stats
          WHERE workspace_id = ${input.workspaceId}
            AND day BETWEEN ${from}::date AND ${to}::date
          ORDER BY day ASC, metric ASC
        `;

    return rows.map(r => ({
      day: this.formatDay(r.day),
      metric: r.metric,
      value: Number(r.value),
    }));
  }

  /**
   * Admin-recovery handle. Re-rolls daily aggregates for the workspace
   * over the last `daysBack` days. Returns the number of (day, metric)
   * rows that were upserted so the operator gets immediate feedback.
   *
   * Caller permission: `Workspace.Settings.Update` (workspace admin).
   */
  @Mutation(() => Int)
  async backfillAnalytics(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('daysBack', { type: () => Int }) daysBack: number
  ): Promise<number> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    if (!Number.isFinite(daysBack) || daysBack <= 0) {
      // Friendly typed error (UserFriendlyError) — finding #13.
      throw new BadRequest('daysBack must be a positive integer.');
    }
    // Soft cap so a typo (e.g. 365_000) can't run for an hour against
    // every row in the table. 365 days is more than any realistic
    // backfill window.
    const lookback = Math.min(Math.floor(daysBack), 365);

    const result = await this.aggregation.runForWorkspace(
      workspaceId,
      lookback
    );
    this.logger.log(
      JSON.stringify({
        event: 'mongo_aggregation_backfill',
        workspaceId,
        daysBack: lookback,
        metricsComputed: result.metricsComputed,
        rowsUpserted: result.rowsUpserted,
        errorCount: result.errors.length,
      })
    );
    return result.rowsUpserted;
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  /**
   * Parse a `YYYY-MM-DD` string into a Date at UTC midnight. The
   * Postgres `DATE` column is timezone-less, so we pin the wire
   * representation to UTC midnight; otherwise local-tz drift would
   * make boundary days off-by-one for clients in negative timezones.
   */
  private parseDay(value: string, fieldName: string): Date {
    // Friendly typed errors (UserFriendlyError) — finding #13.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequest(`\`${fieldName}\` must be in YYYY-MM-DD format.`);
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequest(`\`${fieldName}\` is not a valid date.`);
    }
    return date;
  }

  /** Serialise a Postgres DATE back to `YYYY-MM-DD` for the wire. */
  private formatDay(day: Date): string {
    // toISOString → `2026-05-20T00:00:00.000Z` → slice the date portion.
    return day.toISOString().slice(0, 10);
  }
}
