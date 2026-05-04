import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { SocialConnection } from '@prisma/client';
import { PrismaClient, SocialPlatform } from '@prisma/client';
import type { Request } from 'express';

import { Config } from '../../../../base';
import { Public } from '../../../../core/auth';
import { LineMapper } from '../../normalizer/platform-mappers/line.mapper';
import { IngestionService } from '../ingestion.service';

/**
 * LINE webhook receiver.
 *
 * Behavior:
 *   1. Compute HMAC-SHA256(channelSecret, rawBody), base64-encode it,
 *      and timing-safe-compare to the X-Line-Signature header.
 *      Reject with 401 (no body) on missing or bad signature.
 *   2. Parse JSON. For each event, look up the SocialConnection by
 *      (externalAccountId from event.source, platform=LINE_VOOM). If
 *      not found, log + skip — could be a webhook for a disconnected
 *      channel.
 *   3. Map via LineMapper.toSocialEvent and call
 *      IngestionService.normalizeAndStore. The Round A scaffolding for
 *      that service throws NOT_IMPLEMENTED — we log + swallow so we
 *      always return 200 within the LINE retry budget (~1s).
 *
 * Sources:
 *   - https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/
 *   - https://developers.line.biz/en/reference/messaging-api/#webhook-event-objects
 *
 * Pattern mimicked from `packages/backend/server/src/plugins/payment/controller.ts`
 * (Stripe webhook): RawBodyRequest<Request> + req.rawBody for the
 * signature payload.
 */
@Controller('/api/integrations/line')
export class LineWebhookController {
  private readonly logger = new Logger(LineWebhookController.name);

  constructor(
    private readonly config: Config,
    private readonly db: PrismaClient,
    private readonly ingestion: IngestionService,
    private readonly mapper: LineMapper
  ) {}

  @Public()
  @Post('/webhook')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-line-signature') signature?: string
  ): Promise<{ ok: true }> {
    const channelSecret = this.config.analytics?.line?.channelSecret;
    if (!channelSecret) {
      // Fail-closed: not configured = reject. We do NOT echo the reason
      // in the body — anything we say here helps an attacker calibrate.
      this.logger.warn(
        'LINE webhook hit but analyticsLine.channelSecret is not configured'
      );
      throw new HttpUnauthorized();
    }

    if (!signature) {
      throw new HttpUnauthorized();
    }

    const rawBody = req.rawBody;
    if (!rawBody || rawBody.length === 0) {
      throw new HttpUnauthorized();
    }

    if (!this.verifySignature(channelSecret, rawBody, signature)) {
      // Per LINE docs + PRD §6: fail-closed, no body.
      throw new HttpUnauthorized();
    }

    // Body is verified — safe to parse.
    let body: { events?: unknown[]; destination?: string };
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch (error) {
      this.logger.error(
        'LINE webhook: signature verified but JSON parse failed',
        error instanceof Error ? error.stack : String(error)
      );
      // Still 200 — bad JSON from LINE is not a retry-worthy failure.
      return { ok: true };
    }

    const events = Array.isArray(body.events) ? body.events : [];
    if (events.length === 0) {
      // LINE sends empty `events: []` as a webhook URL verification probe.
      return { ok: true };
    }

    // Process events in parallel but never let one failure block the response.
    await Promise.all(
      events.map(rawEvent => this.processEvent(rawEvent).catch(err => {
        this.logger.error(
          'LINE webhook: event processing failed',
          err instanceof Error ? err.stack : String(err)
        );
      }))
    );

    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // private helpers
  // -------------------------------------------------------------------------

  private verifySignature(
    channelSecret: string,
    rawBody: Buffer,
    signature: string
  ): boolean {
    const computed = createHmac('sha256', channelSecret)
      .update(rawBody)
      .digest('base64');

    const a = Buffer.from(computed, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length) return false;
    try {
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private async processEvent(rawEvent: unknown): Promise<void> {
    const event = (rawEvent ?? {}) as {
      source?: { userId?: string; groupId?: string; roomId?: string };
    };

    const externalAccountId =
      event.source?.userId ??
      event.source?.groupId ??
      event.source?.roomId;

    if (!externalAccountId) {
      this.logger.debug('LINE webhook: event has no source id, skipping');
      return;
    }

    const connection = await this.findConnection(externalAccountId);
    if (!connection) {
      this.logger.debug(
        `LINE webhook: no connection for externalAccountId=${externalAccountId}, skipping`
      );
      return;
    }

    const socialEvent = this.mapper.toSocialEvent(
      rawEvent,
      connection.id,
      connection.workspaceId
    );

    try {
      // CONTRACT: ingestion.service.ts is a Round A stub and currently
      // throws NOT_IMPLEMENTED. We swallow so the webhook still 200s —
      // LINE retries on non-200, and the inbound surface should not
      // depend on a downstream service that isn't built yet.
      await this.ingestion.normalizeAndStore(
        socialEvent,
        SocialPlatform.LINE_VOOM,
        connection.id
      );
    } catch (error) {
      this.logger.warn(
        `LINE webhook: ingestion.normalizeAndStore failed (likely Round A NOT_IMPLEMENTED): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async findConnection(
    externalAccountId: string
  ): Promise<SocialConnection | null> {
    return this.db.socialConnection.findFirst({
      where: {
        platform: SocialPlatform.LINE_VOOM,
        externalAccountId,
      },
    });
  }
}

/**
 * 401 with empty body — we never want to telegraph signature-failure
 * reasons in the response body. NestJS's `HttpException` maps directly
 * to the status code we pass.
 */
class HttpUnauthorized extends HttpException {
  constructor() {
    super('', HttpStatus.UNAUTHORIZED);
  }
}
