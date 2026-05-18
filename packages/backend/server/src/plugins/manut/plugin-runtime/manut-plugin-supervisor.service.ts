import { Injectable, Logger } from '@nestjs/common';

/**
 * Exponential-backoff supervisor for crashed plugin workers.
 *
 * Each plugin gets its own restart ledger keyed by `pluginId`. We
 * cap the number of restarts within a sliding 10-minute window —
 * a plugin that keeps crashing through 5 attempts is parked in
 * `CRASHED` status and not auto-restarted again until an operator
 * touches the DB row.
 *
 * Sequence (default settings): 1s, 2s, 4s, 8s, 16s — capped at 60s
 * each. Max 5 attempts per `windowMs` (default 10 min).
 *
 * Pure timing logic, no side effects on the host. The actual
 * `fork()` call lives in `manut-plugin-runtime.service.ts` so the
 * supervisor can be tested in isolation with a fake clock.
 */
@Injectable()
export class ManutPluginSupervisorService {
  private readonly logger = new Logger(ManutPluginSupervisorService.name);
  private readonly ledger = new Map<string, RestartLedgerEntry>();

  // Defaults — overridable in tests via setOptionsForTesting(). Direct
  // field init (not constructor params) keeps NestJS DI happy: a
  // constructor param of an interface type is reflected as `Object` at
  // runtime, which the IoC container can't resolve. v1.12.0 scar — see
  // CLAUDE.md §6 "NestJS DI metadata traps".
  private baseMs = 1_000;
  private maxBackoffMs = 60_000;
  private maxAttempts = 5;
  private windowMs = 10 * 60_000;

  /**
   * Override the timing knobs from a test. Production code never calls
   * this — production just relies on the field defaults above.
   */
  setOptionsForTesting(options: SupervisorOptions): void {
    if (options.baseMs !== undefined) this.baseMs = options.baseMs;
    if (options.maxBackoffMs !== undefined)
      this.maxBackoffMs = options.maxBackoffMs;
    if (options.maxAttempts !== undefined)
      this.maxAttempts = options.maxAttempts;
    if (options.windowMs !== undefined) this.windowMs = options.windowMs;
  }

  /**
   * Record a crash and return either the next delay in ms or
   * `'park'` when the plugin has exhausted its restart budget.
   *
   * `now` is injectable for tests so we don't have to wait wall
   * clock to exercise the sliding window.
   */
  recordCrash(
    pluginId: string,
    now: number = Date.now()
  ): { decision: 'restart'; delayMs: number } | { decision: 'park' } {
    const entry = this.ledger.get(pluginId) ?? {
      crashes: [] as number[],
    };

    // Drop crashes outside the sliding window.
    entry.crashes = entry.crashes.filter(t => now - t < this.windowMs);
    entry.crashes.push(now);
    this.ledger.set(pluginId, entry);

    if (entry.crashes.length > this.maxAttempts) {
      this.logger.error(
        `plugin ${pluginId} exceeded ${this.maxAttempts} crashes in ${this.windowMs}ms — parking`
      );
      return { decision: 'park' };
    }

    const attempt = entry.crashes.length - 1; // 0-indexed
    const exponential = this.baseMs * 2 ** attempt;
    const delayMs = Math.min(exponential, this.maxBackoffMs);
    this.logger.warn(
      `plugin ${pluginId} crash #${entry.crashes.length}; restart in ${delayMs}ms`
    );
    return { decision: 'restart', delayMs };
  }

  /**
   * Reset the crash ledger after a successful clean shutdown or
   * operator intervention.
   */
  clear(pluginId: string): void {
    this.ledger.delete(pluginId);
  }

  /** Number of crashes inside the sliding window. Test hook. */
  crashCount(pluginId: string, now: number = Date.now()): number {
    const entry = this.ledger.get(pluginId);
    if (!entry) return 0;
    return entry.crashes.filter(t => now - t < this.windowMs).length;
  }
}

export interface SupervisorOptions {
  baseMs?: number;
  maxBackoffMs?: number;
  maxAttempts?: number;
  windowMs?: number;
}

interface RestartLedgerEntry {
  crashes: number[];
}
