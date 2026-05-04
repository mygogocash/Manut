// TikTok webhook receiver — Display-API tier only.
// video.publish + video.upload events DO NOT exist outside partner-status apps.
// Publish detection happens via tiktok.poller.ts polling /v2/video/list/ at 15-min cadence.
// See docs/analytics-platform.md risk #12.

import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClient, SocialPlatform } from '@prisma/client';
import type { Request, Response } from 'express';

import { Config } from '../../../../base';
import { Public } from '../../../../core/auth';
import { TikTokMapper } from '../../normalizer/platform-mappers/tiktok.mapper';
import { IngestionService } from '../ingestion.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

interface TikTokWebhookEnvelope {
  event?: string;
  client_key?: string;
  create_time?: number;
  user_openid?: string;
  content?: string | Record<string, unknown>;
  // Some payload variants nest the user object directly.
  user?: { open_id?: string };
}

@Controller('/api/integrations/tiktok/webhook')
export class TikTokWebhookController {
  private readonly logger = new Logger(TikTokWebhookController.name);

  constructor(
    private readonly ingestion: IngestionService,
    private readonly mapper: TikTokMapper,
    private readonly db: PrismaClient,
    private readonly config: Config
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() req: RawBodyRequest,
    @Res() res: Response,
    @Headers('x-tt-signature') signature?: string
  ) {
    const raw = this.getRawBody(req);
    if (!raw) {
      // Fail-closed: if we cannot get the raw body we cannot verify the HMAC.
      throw new UnauthorizedException();
    }

    if (!this.verifySignature(raw, signature)) {
      throw new UnauthorizedException();
    }

    let body: TikTokWebhookEnvelope;
    try {
      body = JSON.parse(raw.toString('utf8')) as TikTokWebhookEnvelope;
    } catch {
      // Invalid JSON despite valid signature is suspicious; ack-and-drop so
      // TikTok doesn't retry indefinitely, but log it.
      this.logger.warn('TikTok webhook: signature ok but JSON invalid');
      return res.status(HttpStatus.OK).json({ ok: true });
    }

    const eventType = body.event ?? '';

    if (eventType === 'video.upload.failed') {
      await this.handleUploadFailed(body);
    } else {
      // Per PRD risk #12: only video.upload.failed is supported on the
      // Display-API tier. Other events (if any arrive) are logged and acked
      // so TikTok does not put us into a retry storm.
      this.logger.warn(
        `TikTok webhook: unhandled event type "${eventType}" — acked`
      );
    }

    return res.status(HttpStatus.OK).json({ ok: true });
  }

  // ---------------------------------------------------------------------------
  // private
  // ---------------------------------------------------------------------------

  private getRawBody(req: RawBodyRequest): Buffer | null {
    if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
      return req.rawBody;
    }
    // Fallback: if a JSON parser already consumed the body, re-stringify.
    // This is a soft fallback — production should configure express to keep
    // the raw body for this controller via a verify hook.
    if (req.body) {
      try {
        return Buffer.from(JSON.stringify(req.body), 'utf8');
      } catch {
        return null;
      }
    }
    return null;
  }

  private verifySignature(raw: Buffer, signature?: string): boolean {
    // Config consolidated in plugins/analytics/config.ts — see token-store.ts.
    const secret = this.config.analytics?.tiktok?.clientSecret ?? '';
    if (!secret) {
      this.logger.error(
        'TikTok webhook: analytics.tiktok.clientSecret not configured — rejecting'
      );
      return false;
    }
    if (!signature) {
      return false;
    }

    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const provided = signature.trim().toLowerCase();
    const expectedHex = expected.toLowerCase();

    if (provided.length !== expectedHex.length) {
      return false;
    }

    try {
      return timingSafeEqual(
        Buffer.from(provided, 'utf8'),
        Buffer.from(expectedHex, 'utf8')
      );
    } catch {
      return false;
    }
  }

  private async handleUploadFailed(
    body: TikTokWebhookEnvelope
  ): Promise<void> {
    const openId = body.user?.open_id ?? body.user_openid ?? '';
    if (!openId) {
      this.logger.warn(
        'TikTok webhook video.upload.failed: missing open_id, dropping'
      );
      return;
    }

    const connection = await this.db.socialConnection.findFirst({
      where: {
        platform: SocialPlatform.TIKTOK,
        externalAccountId: openId,
      },
    });

    if (!connection) {
      // Unknown account — could be a stale connection or a dev-mode webhook.
      // Ack but skip ingestion; do not throw (TikTok would retry).
      this.logger.warn(
        `TikTok webhook video.upload.failed: no connection for open_id ${openId}`
      );
      return;
    }

    try {
      const event = this.mapper.toFailedUploadEvent(
        body as unknown as Record<string, unknown>,
        connection
      );
      // IngestionService.normalizeAndStore is a Round A stub — it will throw.
      // Swallow that here so we still ack within 1s; a follow-up phase wires
      // the real persistence.
      await this.ingestion.normalizeAndStore(event, 'TIKTOK', connection.id);
    } catch (error: unknown) {
      this.logger.error(
        `TikTok webhook ingestion failed (will not retry): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
