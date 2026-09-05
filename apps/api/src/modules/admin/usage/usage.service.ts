import { prisma } from "@/infrastructure/database/prisma";
import {
  findPerUserActivityFromPostHog,
  isPostHogActivityConfigured,
} from "@/modules/admin/usage/posthog-activity";
import { usageRepository } from "@/modules/admin/usage/usage.repository";

export type ActivitySource = "audit_log" | "posthog";

export interface PerUserStorageDto {
  userId: string;
  name: string;
  email: string;
  totalBytes: number;
  fileCount: number;
  breakdown: {
    generalBytes: number;
    hrBytes: number;
    dataroomBytes: number;
  };
  lastUploadAt: string | null;
}

export interface WorkspaceUsageTotalsDto {
  totalUsers: number;
  activeUsers: number;
  storageBytes: number;
  fileCount: number;
  filesAdded30d: number;
}

export interface BucketSnapshotDto {
  bucket: string;
  bytes: number;
  objectCount: number;
  capturedAt: string;
}

export interface BucketHealthDto {
  buckets: BucketSnapshotDto[];
  bucketTotalBytes: number;
  trackedBytes: number;
  unaccountedBytes: number;
  capturedAt: string | null;
}

export interface PerUserActivityDto {
  userId: string;
  name: string;
  email: string;
  events30d: number;
  activeDays30d: number;
  breakdown: {
    leaveEvents30d: number;
    expenseEvents30d: number;
    ariaEvents30d: number;
  };
  topAction: string | null;
  lastActiveAt: string | null;
}

/**
 * BigInt → number coercion is safe for Postgres `bigint` returned by SUM(int4).
 * Worst-case 50 staff × hundreds of GB each is well under Number.MAX_SAFE_INTEGER
 * (≈ 9 PB). If we ever ingest larger objects, switch the wire format to string.
 */
function toNumber(b: bigint): number {
  return Number(b);
}

export const usageService = {
  async getTotals(): Promise<WorkspaceUsageTotalsDto> {
    const [totalUsers, activeUsers, storage] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      usageRepository.findWorkspaceStorageTotals(),
    ]);

    return {
      totalUsers,
      activeUsers,
      storageBytes: toNumber(storage.totalBytes),
      fileCount: storage.fileCount,
      filesAdded30d: storage.filesAdded30d,
    };
  },

  async getBucketHealth(): Promise<BucketHealthDto> {
    const [snapshots, dbTotals] = await Promise.all([
      usageRepository.findLatestBucketSnapshots(),
      usageRepository.findWorkspaceStorageTotals(),
    ]);

    const buckets = snapshots.map((s) => ({
      bucket: s.bucket,
      bytes: toNumber(s.bytes),
      objectCount: s.objectCount,
      capturedAt: s.capturedAt.toISOString(),
    }));

    const bucketTotalBytes = buckets.reduce((sum, b) => sum + b.bytes, 0);
    const trackedBytes = toNumber(dbTotals.totalBytes);
    const unaccountedBytes = Math.max(0, bucketTotalBytes - trackedBytes);
    const capturedAt =
      buckets.length > 0
        ? buckets.reduce((max, b) => (b.capturedAt > max.capturedAt ? b : max))
            .capturedAt
        : null;

    return {
      buckets,
      bucketTotalBytes,
      trackedBytes,
      unaccountedBytes,
      capturedAt,
    };
  },

  async listUserActivity(params: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{
    data: PerUserActivityDto[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      source: ActivitySource;
    };
  }> {
    let source: ActivitySource = "audit_log";
    let rows: Awaited<
      ReturnType<typeof usageRepository.findPerUserActivity>
    >["rows"];
    let total: number;

    if (isPostHogActivityConfigured()) {
      const posthogResult = await findPerUserActivityFromPostHog(params);
      if (posthogResult) {
        rows = posthogResult.rows;
        total = posthogResult.total;
        source = "posthog";
      } else {
        const fallback = await usageRepository.findPerUserActivity(params);
        rows = fallback.rows;
        total = fallback.total;
      }
    } else {
      const result = await usageRepository.findPerUserActivity(params);
      rows = result.rows;
      total = result.total;
    }

    return {
      data: rows.map((r) => ({
        userId: r.userId,
        name: r.name,
        email: r.email,
        events30d: r.events30d,
        activeDays30d: r.activeDays30d,
        breakdown: {
          leaveEvents30d: r.leaveEvents30d,
          expenseEvents30d: r.expenseEvents30d,
          ariaEvents30d: r.ariaEvents30d,
        },
        topAction: r.topAction,
        lastActiveAt: r.lastActiveAt ? r.lastActiveAt.toISOString() : null,
      })),
      meta: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
        source,
      },
    };
  },

  async listUserStorage(params: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{
    data: PerUserStorageDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { rows, total } = await usageRepository.findPerUserStorage(params);
    return {
      data: rows.map((r) => ({
        userId: r.userId,
        name: r.name,
        email: r.email,
        totalBytes: toNumber(r.totalBytes),
        fileCount: r.fileCount,
        breakdown: {
          generalBytes: toNumber(r.generalBytes),
          hrBytes: toNumber(r.hrBytes),
          dataroomBytes: toNumber(r.dataroomBytes),
        },
        lastUploadAt: r.lastUploadAt ? r.lastUploadAt.toISOString() : null,
      })),
      meta: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  },
};
