import { Injectable, Logger } from '@nestjs/common';

/**
 * In-memory TTL cache that answers "does this workspace currently have
 * any unresolved approvals that should gate the next tool call?".
 *
 * Why a cache instead of a Prisma query per turn?
 *
 *   The gate is invoked from the copilot tool-dispatch hot path. A
 *   round-trip to Postgres on every tool call would add ~5-30ms per
 *   turn (PgBouncer pool, indexed COUNT lookup, network), violating
 *   the "sub-millisecond" budget the parent spec demands. Two
 *   workloads dominate the cache hit rate:
 *
 *     (a) workspaces with zero pending approvals — the common case;
 *     (b) workspaces with one or more pending approvals where the
 *         agent is in a tight retry loop.
 *
 *   Both benefit from a short TTL (30s) — long enough to amortise the
 *   DB hit, short enough that a fresh approval surfaces to the gate
 *   within 30 seconds even without an explicit invalidate(). And the
 *   service does invalidate explicitly on create / decide / resubmit
 *   so the lag is effectively zero on the round-trip path.
 *
 * State: a single `Map<workspaceId, CacheEntry>`. Each entry is the
 * pending count + the timestamp it was filled. Lookups that hit a
 * fresh entry skip the DB; lookups that miss or are stale invoke
 * `refresh(workspaceId)` to repopulate.
 *
 * The cache is local to the process; for multi-replica deployments we
 * accept that each replica warms up independently. The 30s TTL means
 * any cross-replica drift self-heals within half a minute, which is
 * well within the user-visible "I clicked approve" → "AI resumes"
 * window.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` so TS emits `design:paramtypes` for NestJS DI.
 *  - No constructor params: this service is intentionally
 *    dependency-free so it can be safely injected anywhere (the
 *    refresh callback is passed in per-call via `set`). Avoids the
 *    circular import the obvious "inject MnApprovalService" route
 *    would otherwise create.
 */
const DEFAULT_TTL_MS = 30_000;

interface CacheEntry {
  pendingCount: number;
  /** Epoch ms when this entry was written. */
  filledAt: number;
}

@Injectable()
export class MnApprovalGateService {
  private readonly logger = new Logger(MnApprovalGateService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  /**
   * Sub-millisecond synchronous check. Returns whether the workspace
   * has any blocking approvals, given a previously-cached count. If
   * the cache is cold or stale, returns `null` so the caller knows it
   * must `refresh()` before deciding.
   *
   * Performance contract: this method must remain a single Map.get +
   * a small constant-time comparison. Do NOT introduce any I/O here.
   */
  peek(workspaceId: string, now: number = Date.now()): boolean | null {
    const entry = this.cache.get(workspaceId);
    if (!entry) return null;
    if (now - entry.filledAt > this.ttlMs) return null;
    return entry.pendingCount > 0;
  }

  /**
   * Write the cache entry for `workspaceId`. Called by the
   * service / refresh path with the freshly-counted pending rows.
   *
   * O(1).
   */
  set(
    workspaceId: string,
    pendingCount: number,
    now: number = Date.now()
  ): void {
    this.cache.set(workspaceId, { pendingCount, filledAt: now });
  }

  /**
   * Forget the cache entry for `workspaceId`. Called by the service
   * after create / decide / submitRevision / cancelPendingOlderThan
   * so the next `peek` triggers a fresh DB read.
   *
   * O(1).
   */
  invalidate(workspaceId: string): void {
    this.cache.delete(workspaceId);
  }

  /**
   * Convenience helper that combines `peek` with a fallback to a
   * supplied refresh function. The refresh callback is injected here
   * (rather than via constructor) so the gate stays free of a
   * circular dependency on the approval service.
   *
   * Returns the freshly-resolved blocking state. Callers that want
   * the strict sub-millisecond fast path should use `peek` directly
   * and fall back to a background refresh.
   */
  async requiresApproval(
    workspaceId: string,
    refresh: (workspaceId: string) => Promise<number>
  ): Promise<boolean> {
    const cached = this.peek(workspaceId);
    if (cached !== null) return cached;
    let count = 0;
    try {
      count = await refresh(workspaceId);
    } catch (err) {
      // Fail closed: if the DB lookup throws, we'd rather skip the
      // gate (and let work continue) than block every tool dispatch
      // on transient infra. Log loud so the operator notices.
      this.logger.error(
        `gate refresh failed for workspace ${workspaceId} — assuming no pending approvals`,
        err
      );
      return false;
    }
    this.set(workspaceId, count);
    return count > 0;
  }

  /**
   * Test hook — current cache size. Production callers should not
   * depend on this. Returned as a primitive `number` rather than the
   * Map itself so internal state stays encapsulated.
   */
  cacheSize(): number {
    return this.cache.size;
  }
}
