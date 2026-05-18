import { Injectable, Logger } from '@nestjs/common';
import { MnAgentAdapterType } from '@prisma/client';

import type {
  MnAdapter,
  MnAdapterInvokeInput,
  MnAdapterResult,
} from './manut-adapter.interface';
import { scrubSecrets } from './manut-adapter.interface';

/** Default base URL for the Cursor cloud agents API. */
const DEFAULT_BASE_URL = 'https://api.cursor.com/v1';

/** Default per-invocation timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 300_000;

/** Default poll interval for the status loop. */
const DEFAULT_POLL_INTERVAL_MS = 5_000;

/** Terminal states reported by the (hypothetical) Cursor API. */
const TERMINAL_STATES = new Set([
  'succeeded',
  'failed',
  'cancelled',
  'timeout',
]);

/** Secret config fields scrubbed from log lines. */
const SECRET_KEYS = ['cursorApiKey'] as const;

/** Shape of `adapterConfig` for a CURSOR_CLOUD adapter. */
export interface CursorCloudAdapterConfig {
  /** Cursor cloud-agent API key. SCRUBBED in all log lines. */
  cursorApiKey: string;
  /** Cursor model id (e.g. `cursor-fast`, `claude-sonnet-4`). */
  modelId: string;
  /** Override the API base URL. Used by tests + on-prem Cursor deployments. */
  baseUrl?: string;
  /** Per-invocation timeout in milliseconds. Defaults to 300s. */
  timeoutMs?: number;
  /** How often to poll the status endpoint. Defaults to 5s. */
  pollIntervalMs?: number;
}

/**
 * M8 — Cursor cloud-agent adapter.
 *
 * Wraps a hypothetical Cursor cloud-agents REST API (`POST /agents/jobs`
 * → `{ jobId, status }`, then `GET /agents/jobs/:jobId` until status
 * is terminal). Cursor's public cloud-agents API surface is still in
 * flux as of 2026 — this adapter is shipped as a scaffold so the
 * adapter type is reserved and the contract is in place; when the
 * concrete API stabilises the request/response shapes can be
 * adjusted without touching callers.
 *
 * When no `baseUrl` override is configured AND the API key is the
 * literal string `'stub'`, the adapter returns a synthetic "not yet
 * wired" result — useful for smoke-testing the wiring without a real
 * Cursor account.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` decorator (v1.12.0 DI scar).
 *  - `cursorApiKey` is in `SECRET_KEYS`. The logger only ever emits
 *    the scrubbed config.
 *  - All transport errors are wrapped in the `MnAdapterResult`
 *    envelope, never thrown.
 */
@Injectable()
export class MnCursorCloudAdapter implements MnAdapter {
  readonly adapterType: MnAgentAdapterType = MnAgentAdapterType.CURSOR_CLOUD;

  private readonly logger = new Logger(MnCursorCloudAdapter.name);

  validateConfig(adapterConfig: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    const apiKey = adapterConfig.cursorApiKey;
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      errors.push('cursorApiKey is required and must be a non-empty string');
    }

    const modelId = adapterConfig.modelId;
    if (typeof modelId !== 'string' || modelId.length === 0) {
      errors.push('modelId is required and must be a non-empty string');
    }

    const baseUrl = adapterConfig.baseUrl;
    if (baseUrl !== undefined && baseUrl !== null) {
      if (typeof baseUrl !== 'string') {
        errors.push('baseUrl must be a string');
      } else {
        try {
          // Construct only to validate; the result is discarded.
           
          new URL(baseUrl);
        } catch {
          errors.push('baseUrl is not a valid URL');
        }
      }
    }

    const timeout = adapterConfig.timeoutMs;
    if (
      timeout !== undefined &&
      timeout !== null &&
      (typeof timeout !== 'number' || timeout <= 0 || timeout > 1_800_000)
    ) {
      errors.push('timeoutMs must be a positive number ≤ 1800000');
    }

    const pollInterval = adapterConfig.pollIntervalMs;
    if (
      pollInterval !== undefined &&
      pollInterval !== null &&
      (typeof pollInterval !== 'number' ||
        pollInterval < 500 ||
        pollInterval > 60_000)
    ) {
      errors.push('pollIntervalMs must be a number in [500, 60000]');
    }

    return { valid: errors.length === 0, errors };
  }

  async invoke(input: MnAdapterInvokeInput): Promise<MnAdapterResult> {
    const validation = this.validateConfig(input.adapterConfig);
    if (!validation.valid) {
      return {
        ok: false,
        error: `invalid adapter config: ${validation.errors.join('; ')}`,
        durationMs: 0,
      };
    }

    const config = input.adapterConfig as unknown as CursorCloudAdapterConfig;
    const start = performance.now();

    // Convenience stub: explicit "not wired" signal so the rest of
    // the heartbeat pipeline can exercise this code path in dev
    // without a real Cursor account.
    if (config.cursorApiKey === 'stub') {
      this.logger.warn(
        `cursor adapter stub-invoked for agent=${input.agentId}: ` +
          `set a real cursorApiKey to dispatch to the live API. ` +
          `config=${JSON.stringify(scrubSecrets(input.adapterConfig, SECRET_KEYS))}`
      );
      return {
        ok: false,
        error: 'cursor cloud adapter not yet wired (apiKey === "stub")',
        durationMs: performance.now() - start,
      };
    }

    const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const deadline = start + timeoutMs;

    try {
      // 1. POST /agents/jobs to enqueue
      const submitResponse = await fetch(`${baseUrl}/agents/jobs`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.cursorApiKey}`,
        },
        body: JSON.stringify({
          model: config.modelId,
          agentId: input.agentId,
          workspaceId: input.workspaceId,
          payload: input.payload,
        }),
      });

      if (!submitResponse.ok) {
        const text = await submitResponse
          .text()
          .catch(() => '<unreadable body>');
        return {
          ok: false,
          error: `cursor submit returned HTTP ${submitResponse.status}: ${text.slice(0, 200)}`,
          durationMs: performance.now() - start,
        };
      }

      const submitJson = (await submitResponse.json().catch(() => ({}))) as {
        jobId?: string;
      };
      const jobId = submitJson.jobId;
      if (!jobId) {
        return {
          ok: false,
          error: 'cursor submit response missing jobId',
          durationMs: performance.now() - start,
        };
      }

      // 2. Poll GET /agents/jobs/:jobId until terminal or timeout
      while (performance.now() < deadline) {
        const statusResponse = await fetch(`${baseUrl}/agents/jobs/${jobId}`, {
          headers: {
            authorization: `Bearer ${config.cursorApiKey}`,
          },
        });

        if (!statusResponse.ok) {
          const text = await statusResponse
            .text()
            .catch(() => '<unreadable body>');
          return {
            ok: false,
            externalRunId: jobId,
            error: `cursor poll returned HTTP ${statusResponse.status}: ${text.slice(0, 200)}`,
            durationMs: performance.now() - start,
          };
        }

        const statusJson = (await statusResponse.json().catch(() => ({}))) as {
          status?: string;
          result?: unknown;
          error?: string;
        };

        const status = (statusJson.status ?? '').toLowerCase();
        if (TERMINAL_STATES.has(status)) {
          const ok = status === 'succeeded';
          return {
            ok,
            externalRunId: jobId,
            result: statusJson.result,
            error: ok
              ? undefined
              : (statusJson.error ?? `cursor status=${status}`),
            durationMs: performance.now() - start,
          };
        }

        await new Promise(r => setTimeout(r, pollIntervalMs));
      }

      return {
        ok: false,
        externalRunId: jobId,
        error: `cursor job timed out after ${timeoutMs}ms`,
        durationMs: performance.now() - start,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `cursor invocation failed for agent=${input.agentId}: ${message}. ` +
          `config=${JSON.stringify(scrubSecrets(input.adapterConfig, SECRET_KEYS))}`
      );
      return {
        ok: false,
        error: message,
        durationMs: performance.now() - start,
      };
    }
  }
}
