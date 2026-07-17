import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import { STORAGE_BUCKETS } from "@/infrastructure/storage/supabase-storage";
import {
  isSupabaseConfigured,
  supabaseAdmin,
} from "@/infrastructure/supabase/admin";

const PAGE_SIZE = 1000;
const MAX_RECURSION_DEPTH = 8;

interface BucketTotals {
  bytes: bigint;
  objectCount: number;
}

interface SupabaseStorageObject {
  name: string;
  id?: string | null;
  metadata?: { size?: number | null } | null;
}

/**
 * Recursively walk a Supabase Storage bucket, summing object sizes.
 *
 * Supabase's `list(prefix, opts)` returns one page at a time. Folders show
 * up as entries with a `null` id and no metadata; files have a uuid id and
 * `metadata.size` in bytes. Recursion bottoms out at MAX_RECURSION_DEPTH to
 * avoid runaway loops if the bucket has cyclic / overly deep paths.
 */
async function walkBucket(
  bucket: string,
  prefix: string,
  depth: number,
  acc: BucketTotals,
): Promise<void> {
  if (depth > MAX_RECURSION_DEPTH) {
    logger.warn(
      "[storage-snapshot] hit max recursion depth — skipping deeper paths",
      { bucket, prefix, depth },
    );
    return;
  }

  let offset = 0;
  for (;;) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      throw new Error(
        `Supabase list failed for bucket "${bucket}" at "${prefix}": ${error.message}`,
      );
    }

    const items = (data ?? []) as SupabaseStorageObject[];
    if (items.length === 0) break;

    for (const item of items) {
      const isFolder = !item.id;
      if (isFolder) {
        const subPrefix = prefix ? `${prefix}/${item.name}` : item.name;
        await walkBucket(bucket, subPrefix, depth + 1, acc);
        continue;
      }
      const size = item.metadata?.size ?? 0;
      acc.bytes += BigInt(size);
      acc.objectCount += 1;
    }

    if (items.length < PAGE_SIZE) break;
    offset += items.length;
  }
}

export const storageSnapshotService = {
  async refresh(): Promise<{ buckets: number; totalBytes: string }> {
    if (!isSupabaseConfigured) {
      throw new Error(
        "[storage-snapshot] Supabase is not configured — skipping snapshot run",
      );
    }

    const capturedAt = new Date();
    let totalBytes = 0n;
    const rows: Array<{
      bucket: string;
      bytes: bigint;
      objectCount: number;
      capturedAt: Date;
    }> = [];

    for (const bucket of Object.values(STORAGE_BUCKETS)) {
      const acc: BucketTotals = { bytes: 0n, objectCount: 0 };
      try {
        await walkBucket(bucket, "", 0, acc);
      } catch (err) {
        logger.error("[storage-snapshot] bucket walk failed", { bucket, err });
        continue;
      }
      rows.push({
        bucket,
        bytes: acc.bytes,
        objectCount: acc.objectCount,
        capturedAt,
      });
      totalBytes += acc.bytes;
    }

    if (rows.length > 0) {
      await prisma.storageSnapshot.createMany({ data: rows });
    }

    return {
      buckets: rows.length,
      totalBytes: totalBytes.toString(),
    };
  },
};
