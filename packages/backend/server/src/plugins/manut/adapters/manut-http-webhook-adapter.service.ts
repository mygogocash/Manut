import { createHmac } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { MnAgentAdapterType } from '@prisma/client';

import type {
  MnAdapter,
  MnAdapterInvokeInput,
  MnAdapterResult,
} from './manut-adapter.interface';
import { scrubSecrets } from './manut-adapter.interface';

/** Default HMAC algorithm. SHA-256 is the de-facto industry standard. */
const HMAC_ALGORITHM = 'sha256';

/** Default invocation timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Header name that carries the HMAC signature. */
export const SIGNATURE_HEADER = 'x-manut-signature';

/** Header name that carries the timestamp (epoch ms). */
export const TIMESTAMP_HEADER = 'x-manut-timestamp';

/** Header name that carries the workspace id, for receiver routing. */
export const WORKSPACE_HEADER = 'x-manut-workspace-id';

/** Header name that carries the agent id, for receiver routing. */
export const AGENT_HEADER = 'x-manut-agent-id';

/** Config fields that hold secrets and must never be logged in plaintext. */
const SECRET_KEYS = ['signingSecret'] as const;

/** Shape of `adapterConfig` for an HTTP_WEBHOOK adapter. */
export interface HttpWebhookAdapterConfig {
  /** Absolute URL the webhook will POST to. Must be https:// in production. */
  webhookUrl: string;
  /**
   * Shared secret used to sign the request body via HMAC-SHA256. The
   * receiver verifies the `x-manut-signature` header to detect
   * tampering.
   */
  signingSecret: string;
  /** Per-invocation timeout in milliseconds. Defaults to 30s. */
  timeoutMs?: number;
}

/**
 * Builds the canonical signature payload. The receiver MUST reconstruct
 * this exact string (timestamp + "." + body) and compare HMACs in
 * constant time.
 */
export function buildSignaturePayload(timestamp: number, body: string): string {
  return `${timestamp}.${body}`;
}

/**
 * Computes the HMAC-SHA256 hex digest of `payload` keyed by
 * `signingSecret`. Exported so tests can verify the signature
 * shape without hitting the network.
 */
export function computeSignature(
  signingSecret: string,
  payload: string
): string {
  return createHmac(HMAC_ALGORITHM, signingSecret)
    .update(payload)
    .digest('hex');
}

/**
 * M8 — Generic HTTP webhook adapter.
 *
 * POSTs the invocation payload as JSON to a configured webhook URL,
 * signed with an HMAC-SHA256 over `${timestamp}.${body}`. Receivers
 * MUST verify the signature in constant time (e.g. via
 * `crypto.timingSafeEqual`) before acting on the body.
 *
 * Failures (transport errors, non-2xx responses, timeout) are wrapped
 * into the `MnAdapterResult` envelope rather than thrown — see the
 * interface contract.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` decorator so TS emits `design:paramtypes`
 *    (v1.12.0 DI scar). Constructor has no DI deps but the decorator
 *    is mandatory for `providers[]` registration.
 *  - `signingSecret` is marked secret in `SECRET_KEYS`; the scrubber
 *    is exercised in `__tests__/manut/m8-http-webhook-adapter.spec.ts`.
 */
@Injectable()
export class MnHttpWebhookAdapter implements MnAdapter {
  readonly adapterType: MnAgentAdapterType = MnAgentAdapterType.HTTP_WEBHOOK;

  private readonly logger = new Logger(MnHttpWebhookAdapter.name);

  validateConfig(adapterConfig: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const url = adapterConfig.webhookUrl;
    if (typeof url !== 'string' || url.length === 0) {
      errors.push('webhookUrl is required and must be a non-empty string');
    } else {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          errors.push(
            `webhookUrl must use http:// or https:// (got ${parsed.protocol})`
          );
        }
      } catch {
        errors.push('webhookUrl is not a valid URL');
      }
    }

    const secret = adapterConfig.signingSecret;
    if (typeof secret !== 'string' || secret.length < 16) {
      errors.push(
        'signingSecret is required and must be at least 16 characters'
      );
    }

    const timeout = adapterConfig.timeoutMs;
    if (
      timeout !== undefined &&
      timeout !== null &&
      (typeof timeout !== 'number' || timeout <= 0 || timeout > 600_000)
    ) {
      errors.push('timeoutMs must be a positive number ≤ 600000');
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

    const config = input.adapterConfig as unknown as HttpWebhookAdapterConfig;
    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const body = JSON.stringify({
      agentId: input.agentId,
      workspaceId: input.workspaceId,
      payload: input.payload,
    });
    const timestamp = Date.now();
    const signature = computeSignature(
      config.signingSecret,
      buildSignaturePayload(timestamp, body)
    );

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    const start = performance.now();
    try {
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [SIGNATURE_HEADER]: signature,
          [TIMESTAMP_HEADER]: String(timestamp),
          [WORKSPACE_HEADER]: input.workspaceId,
          [AGENT_HEADER]: input.agentId,
        },
        body,
        signal: controller.signal,
      });

      const durationMs = performance.now() - start;

      if (!response.ok) {
        const text = await response.text().catch(() => '<unreadable body>');
        // Log only non-secret config + the truncated response. Never
        // log signingSecret. Truncate response to keep log lines sane.
        this.logger.warn(
          `webhook returned ${response.status} for agent=${input.agentId} ` +
            `workspace=${input.workspaceId} url=${config.webhookUrl}: ${text.slice(0, 200)}`
        );
        return {
          ok: false,
          error: `webhook returned HTTP ${response.status}`,
          durationMs,
        };
      }

      let result: unknown;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      const externalRunId =
        result && typeof result === 'object' && 'deliveryId' in result
          ? String((result as { deliveryId: unknown }).deliveryId)
          : undefined;

      return {
        ok: true,
        externalRunId,
        result,
        durationMs,
      };
    } catch (err) {
      const durationMs = performance.now() - start;
      const message =
        err instanceof Error
          ? err.name === 'AbortError'
            ? `webhook timed out after ${timeoutMs}ms`
            : err.message
          : String(err);
      // Use scrubSecrets defensively before any debug-level dump.
      this.logger.warn(
        `webhook invocation failed for agent=${input.agentId}: ${message}. ` +
          `config=${JSON.stringify(scrubSecrets(input.adapterConfig, SECRET_KEYS))}`
      );
      return {
        ok: false,
        error: message,
        durationMs,
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
