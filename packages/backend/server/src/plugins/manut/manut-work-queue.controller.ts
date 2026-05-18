import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  Body,
  Controller,
  Headers,
  Logger,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { Public } from '../../core/auth';
import { MnWorkQueueService } from './manut-work-queue.service';

/**
 * M14 — Public webhook endpoint for queue intake.
 *
 * Auth model: bearer-style token in the URL path. Any party who knows
 * the `intakeWebhookToken` can POST a payload — that's intentional, the
 * URL IS the credential (same model as Slack incoming webhooks). The
 * token is generated server-side from `randomBytes(24)` and is rotated
 * via the `rotateMnWorkQueueToken` GraphQL mutation, which invalidates
 * the old token immediately because it's a unique key.
 *
 * Optional HMAC signature: callers may set `MANUT_INTAKE_SIGNING_SECRET`
 * in the environment AND send an `x-manut-signature` header containing
 * `sha256=<hex>` of the raw body. When the env var is configured, the
 * controller REQUIRES a valid signature. When unset, signature checks
 * are skipped — keeps the path zero-config for casual webhook senders.
 *
 * Rate limiting: a tiny in-memory token bucket guards each
 * `intakeWebhookToken` separately (60 requests / 60s). Production should
 * front this with a shared rate limiter (Redis / Caddy), but the
 * in-memory fallback is enough to defang an accidental retry loop from
 * a misconfigured sender. Replaced with a single-line shared LRU when
 * the platform gets one.
 *
 * `@Public()` is critical here: the global Auth guard would otherwise
 * reject the request because there's no signed-in user. The auth
 * decision is the token-in-URL check + optional HMAC, period.
 */
const RATE_LIMIT_BUCKET: Map<string, { count: number; resetAt: number }> =
  new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

@Controller('/api/work-queues/:intakeWebhookToken')
export class MnWorkQueueController {
  private readonly logger = new Logger(MnWorkQueueController.name);

  constructor(private readonly svc: MnWorkQueueService) {}

  private checkRateLimit(token: string): boolean {
    const now = Date.now();
    const bucket = RATE_LIMIT_BUCKET.get(token);
    if (!bucket || bucket.resetAt < now) {
      RATE_LIMIT_BUCKET.set(token, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      });
      return true;
    }
    if (bucket.count >= RATE_LIMIT_MAX) {
      return false;
    }
    bucket.count += 1;
    return true;
  }

  /**
   * Constant-time HMAC verification. Returns true when the env var is
   * unset (signatures optional) OR when the supplied signature matches.
   * False only when the env var is set AND the signature is missing /
   * wrong / malformed.
   */
  private verifySignature(
    rawBody: string,
    supplied: string | undefined
  ): boolean {
    const secret = process.env.MANUT_INTAKE_SIGNING_SECRET;
    if (!secret) return true;
    if (!supplied) return false;
    const expected =
      'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(supplied);
    if (a.length !== b.length) return false;
    try {
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  @Public()
  @Post('intake')
  async intake(
    @Param('intakeWebhookToken') token: string,
    @Headers('x-manut-signature') signature: string | undefined,
    @Headers('x-external-ref') externalRefHeader: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    if (!this.checkRateLimit(token)) {
      res.status(429).json({
        error: { code: 'rate_limited', message: 'Too many requests' },
      });
      return;
    }

    // Reject unknown tokens with 404 — don't reveal which tokens were
    // ever valid.
    const queue = await this.svc.findByToken(token);
    if (!queue) {
      res.status(404).json({
        error: { code: 'queue_not_found', message: 'Unknown intake token' },
      });
      return;
    }

    // If signing secret is configured, verify HMAC against the RAW
    // request body. Express's body-parser has already parsed `body` so
    // we re-serialise; if the sender computed HMAC over the raw bytes
    // and the canonical JSON differs, this will mismatch. Senders
    // should canonicalize their payload (no whitespace) when signing.
    const rawBody = JSON.stringify(body ?? {});
    if (!this.verifySignature(rawBody, signature)) {
      this.logger.warn(
        `intake signature mismatch for queue ${queue.id} ` +
          `(remote: ${req.ip ?? 'unknown'})`
      );
      res.status(401).json({
        error: { code: 'invalid_signature', message: 'Signature mismatch' },
      });
      return;
    }

    try {
      const result = await this.svc.routeIntake(queue.id, body, {
        externalRef: externalRefHeader ?? null,
      });
      res.status(200).json({
        ok: true,
        intakeId: result.intake.id,
        taskId: result.taskId,
        matchedRuleIndex: result.matchedRuleIndex,
        assignedAgentId: result.assignedAgentId,
        status: result.intake.status,
      });
    } catch (err: unknown) {
      this.logger.error(
        `intake routing failed for queue ${queue.id}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      res.status(500).json({
        error: {
          code: 'routing_failed',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
  }
}

/** Test hook: clear the in-memory rate limiter between specs. */
export function _resetIntakeRateLimitForTesting(): void {
  RATE_LIMIT_BUCKET.clear();
}
