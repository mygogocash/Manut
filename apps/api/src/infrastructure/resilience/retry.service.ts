import { HttpException } from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";

// AI Project Orchestrator — Phase 7 (Retry Engine). Reusable exponential-backoff
// retry for TRANSIENT failures only (AI, notifications, CRM synchronization,
// webhooks, database deadlocks). Business-validation failures are NEVER retried:
// any HttpException with a client-error status (4xx) is treated as terminal and
// re-thrown immediately. Single-responsibility, dependency-free.

export interface RetryOptions {
  /** Max retry attempts AFTER the first try. Hard cap 5 (PRD). */
  maxRetries?: number;
  /** Base backoff in ms (doubles each attempt). */
  baseDelayMs?: number;
  /** Upper bound on a single backoff delay. */
  maxDelayMs?: number;
  /** Label for logs/metrics. */
  label?: string;
  /** Override the transient-classifier (defaults to `isTransientError`). */
  retryable?: (err: unknown) => boolean;
  /** Injectable sleeper (tests pass a no-op). */
  sleep?: (ms: number) => Promise<void>;
}

const HARD_MAX_RETRIES = 5;

const TRANSIENT_PATTERNS = [
  /econnreset|etimedout|econnrefused|enotfound|socket hang up/i,
  /timeout|timed out/i,
  /deadlock|could not serialize|40001|40p01/i, // pg serialization / deadlock
  /rate limit|too many requests|429/i,
  /unavailable|overloaded|503|502|504|temporarily/i,
  /fetch failed|network/i,
];

/** Prisma transient codes: P2034 (write conflict / deadlock), P1001/P1002/P1008/P1017 (connection). */
const TRANSIENT_PRISMA_CODES = new Set([
  "P2034",
  "P1001",
  "P1002",
  "P1008",
  "P1017",
]);

/**
 * Default transient classifier. A validation / business error (4xx
 * HttpException) is NEVER transient. Everything else is inspected for known
 * transient signatures; unknown errors are treated as NON-transient (fail fast).
 */
export function isTransientError(err: unknown): boolean {
  // Business validation / authorization failures — terminal, never retried.
  if (err instanceof HttpException) {
    return err.status >= 500;
  }
  const code = (err as { code?: unknown })?.code;
  if (typeof code === "string" && TRANSIENT_PRISMA_CODES.has(code)) return true;
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return TRANSIENT_PATTERNS.some((p) => p.test(msg));
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class RetryService {
  /**
   * Run `fn`, retrying only transient failures with exponential backoff + full
   * jitter. Re-throws the last error once retries are exhausted, or immediately
   * for a non-transient (e.g. validation) error.
   */
  async run<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
    const maxRetries = Math.min(
      opts.maxRetries ?? HARD_MAX_RETRIES,
      HARD_MAX_RETRIES,
    );
    const baseDelayMs = opts.baseDelayMs ?? 200;
    const maxDelayMs = opts.maxDelayMs ?? 5000;
    const retryable = opts.retryable ?? isTransientError;
    const sleep = opts.sleep ?? defaultSleep;
    const label = opts.label ?? "operation";

    let attempt = 0;
    // Deterministic jitter (no Math.random dependency) — varies by attempt.
    for (;;) {
      try {
        return await fn();
      } catch (err) {
        if (attempt >= maxRetries || !retryable(err)) {
          throw err;
        }
        attempt++;
        const backoff = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
        const jitter = backoff * 0.25 * ((attempt % 4) / 4);
        logger.warn(`Retry ${attempt}/${maxRetries} for ${label}`, {
          error: err instanceof Error ? err.message : String(err),
          attempt,
        });
        await sleep(Math.round(backoff + jitter));
      }
    }
  }
}

export const retryService = new RetryService();
