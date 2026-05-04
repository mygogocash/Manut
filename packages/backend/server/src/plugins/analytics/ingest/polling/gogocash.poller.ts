import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';

/**
 * GoGoCash internal-data poller.
 *
 * Computes a fixed set of internal KPIs (total_users, signups_*, dau, mau,
 * total_workspaces, new_workspaces_*) every 5 minutes and writes them to
 * `social_metrics` keyed on (workspaceId, platform=GOGOCASH, metricKey,
 * bucket=HOUR, bucketStart) so the analytics resolver can read them.
 *
 * Multi-workspace handling
 * ------------------------
 * The same internal numbers are emitted under EACH workspace that has an
 * ACTIVE GOGOCASH SocialConnection. If no GOGOCASH connection exists yet
 * (the likely v1 state in dev / fresh installs), we still compute the
 * numbers and emit them under the special workspace id `'__internal__'`,
 * so the analytics overview can be smoke-tested without first wiring up
 * an OAuth-style "connection" for the internal data source.
 *
 * Activity definition
 * -------------------
 * The upstream User model exposes neither `lastActiveAt` nor `updatedAt`
 * (only `createdAt` and `disabled`). The closest "active" signal in the
 * schema is `UserSession.createdAt` — i.e. when the user signed in. We
 * use distinct user ids from `UserSession` rows in the relevant window
 * for DAU/MAU. Excludes disabled users.
 */
@Injectable()
export class GogocashPoller {
  private readonly logger = new Logger(GogocashPoller.name);

  constructor(private readonly db: PrismaClient) {}

  // Every 5 minutes — matches the §8 internal cadence in the PRD.
  @Cron('*/5 * * * *')
  async run(): Promise<void> {
    try {
      await this.computeAndPersist();
    } catch (err) {
      this.logger.error('GogocashPoller.run failed', err);
    }
  }

  /**
   * Public entry point so tests can trigger one tick without waiting for
   * the cron scheduler.
   */
  async computeAndPersist(now: Date = new Date()): Promise<void> {
    const metrics = await this.computeMetrics(now);
    const targetWorkspaceIds = await this.resolveTargetWorkspaceIds();
    const bucketStart = floorToHour(now);

    for (const workspaceId of targetWorkspaceIds) {
      for (const [metricKey, value] of Object.entries(metrics)) {
        await this.upsertMetric(workspaceId, metricKey, value, bucketStart);
      }
    }
  }

  private async resolveTargetWorkspaceIds(): Promise<string[]> {
    const connections = await this.db.socialConnection.findMany({
      where: { platform: 'GOGOCASH', status: 'ACTIVE' },
      select: { workspaceId: true },
    });
    const ids = Array.from(new Set(connections.map(c => c.workspaceId)));
    if (ids.length > 0) {
      return ids;
    }
    // Fallback for the v1 / dev state — see file header.
    return ['__internal__'];
  }

  private async computeMetrics(now: Date): Promise<Record<string, number>> {
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      signups24h,
      signups7d,
      signups30d,
      totalWorkspaces,
      newWorkspaces24h,
      newWorkspaces7d,
    ] = await Promise.all([
      this.db.user.count({ where: { disabled: false } }),
      this.db.user.count({
        where: { disabled: false, createdAt: { gt: oneDayAgo } },
      }),
      this.db.user.count({
        where: { disabled: false, createdAt: { gt: sevenDaysAgo } },
      }),
      this.db.user.count({
        where: { disabled: false, createdAt: { gt: thirtyDaysAgo } },
      }),
      this.db.workspace.count(),
      this.db.workspace.count({ where: { createdAt: { gt: oneDayAgo } } }),
      this.db.workspace.count({ where: { createdAt: { gt: sevenDaysAgo } } }),
    ]);

    const dau = await this.countActiveUsersSince(oneDayAgo);
    const mau = await this.countActiveUsersSince(thirtyDaysAgo);

    return {
      total_users: totalUsers,
      signups_24h: signups24h,
      signups_7d: signups7d,
      signups_30d: signups30d,
      dau,
      mau,
      total_workspaces: totalWorkspaces,
      new_workspaces_24h: newWorkspaces24h,
      new_workspaces_7d: newWorkspaces7d,
    };
  }

  /**
   * "Active" = at least one UserSession row created since `since`. Distinct
   * by userId. Excludes disabled users via the relation filter.
   */
  private async countActiveUsersSince(since: Date): Promise<number> {
    const rows = await this.db.userSession.findMany({
      where: {
        createdAt: { gt: since },
        user: { disabled: false },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    return rows.length;
  }

  private async upsertMetric(
    workspaceId: string,
    metricKey: string,
    value: number,
    bucketStart: Date
  ): Promise<void> {
    await this.db.socialMetric.upsert({
      where: {
        workspaceId_platform_metricKey_bucket_bucketStart: {
          workspaceId,
          platform: 'GOGOCASH',
          metricKey,
          bucket: 'HOUR',
          bucketStart,
        },
      },
      update: { value },
      create: {
        workspaceId,
        platform: 'GOGOCASH',
        metricKey,
        bucket: 'HOUR',
        bucketStart,
        value,
      },
    });
  }
}

function floorToHour(d: Date): Date {
  const out = new Date(d.getTime());
  out.setUTCMinutes(0, 0, 0);
  return out;
}
