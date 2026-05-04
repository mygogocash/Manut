import { createHmac, timingSafeEqual } from 'node:crypto';

import type { RawBodyRequest } from '@nestjs/common';
import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';

import { Config } from '../../../../base';
import { Public } from '../../../../core/auth';
import { MetaMapper } from '../../normalizer/platform-mappers/meta.mapper';
import { ThreadsMapper } from '../../normalizer/platform-mappers/threads.mapper';
import { IngestionService } from '../ingestion.service';

/**
 * Meta webhook receiver — covers Facebook, Instagram and Threads, all behind
 * one Meta app per PRD §6.
 *
 * Verification (GET): responds to Meta's verification challenge with the
 * `hub.challenge` value when `hub.mode === 'subscribe'` and the verify token
 * matches `analytics.meta.webhookVerifyToken`. 403 otherwise.
 *
 * Receive (POST):
 *  1. HMAC-SHA256 verification of the raw body using the Meta app secret.
 *     Compared against the `X-Hub-Signature-256` header with timingSafeEqual.
 *     Fail-closed: 401 with no body on missing or bad signature. Never log
 *     the body when rejecting (PRD §6).
 *  2. Per entry: look up the SocialConnection by externalAccountId (entry.id)
 *     and platform inferred from the body's `object` field, run the right
 *     mapper, and hand the normalized event to IngestionService.
 *  3. Always 200 within ~1s — heavy work is the IngestionService's problem
 *     (it can offload to BullMQ). NOT_IMPLEMENTED there is expected for now
 *     and is logged + swallowed so the webhook never tells Meta to retry.
 */
@Controller('/api/integrations/meta/webhook')
export class MetaWebhookController {
  private readonly logger = new Logger(MetaWebhookController.name);

  constructor(
    private readonly config: Config,
    private readonly db: PrismaClient,
    private readonly ingestion: IngestionService,
    private readonly metaMapper: MetaMapper,
    private readonly threadsMapper: ThreadsMapper
  ) {}

  /**
   * GET handler for Meta's webhook verification challenge.
   * Meta calls this with `hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`.
   */
  @Public()
  @Get()
  async verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    const expected = this.config.analytics?.meta?.webhookVerifyToken ?? '';

    if (
      mode === 'subscribe' &&
      typeof token === 'string' &&
      token.length > 0 &&
      expected.length > 0 &&
      this.constantTimeEqualString(token, expected)
    ) {
      res.status(HttpStatus.OK).type('text/plain').send(challenge ?? '');
      return;
    }

    res.status(HttpStatus.FORBIDDEN).send();
  }

  /**
   * POST handler — receives webhook deliveries from Meta. Signature is
   * verified before any payload parsing.
   */
  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('x-hub-signature-256') signature?: string
  ): Promise<void> {
    const rawBody = req.rawBody;
    const appSecret = this.config.analytics?.meta?.appSecret ?? '';

    if (!rawBody || !signature || !appSecret) {
      res.status(HttpStatus.UNAUTHORIZED).send();
      return;
    }

    if (!this.verifySignature(rawBody, signature, appSecret)) {
      // Fail-closed; do NOT echo body or signature back.
      res.status(HttpStatus.UNAUTHORIZED).send();
      return;
    }

    // Acknowledge fast — schedule processing without blocking the response.
    res.status(HttpStatus.OK).send();

    // Parse and dispatch in the background. Errors are logged and swallowed
    // because Meta retries aggressively on 5xx, and our IngestionService
    // is currently NOT_IMPLEMENTED — we don't want a retry storm.
    setImmediate(() => {
      this.dispatch(rawBody).catch(err => {
        this.logger.error(
          'MetaWebhookController.dispatch failed',
          err instanceof Error ? err.stack : String(err)
        );
      });
    });
  }

  // -------------------------------------------------------------------------
  // dispatch
  // -------------------------------------------------------------------------

  private async dispatch(rawBody: Buffer): Promise<void> {
    let parsed: { object?: string; entry?: unknown[] };
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch (err) {
      this.logger.warn(
        `Failed to parse Meta webhook body: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }

    const object = typeof parsed.object === 'string' ? parsed.object : '';
    const entries = Array.isArray(parsed.entry) ? parsed.entry : [];

    const platform = inferPlatform(object);
    if (!platform) {
      this.logger.warn(
        `Meta webhook: unknown object type "${object}" — ignoring ${entries.length} entry(ies)`
      );
      return;
    }

    for (const entry of entries) {
      const externalAccountId = extractEntryId(entry);
      if (!externalAccountId) {
        this.logger.warn('Meta webhook entry missing id — skipping');
        continue;
      }

      const connection = await this.db.socialConnection.findFirst({
        where: {
          platform,
          externalAccountId,
          status: 'ACTIVE',
        },
        select: { id: true, workspaceId: true },
      });

      if (!connection) {
        this.logger.warn(
          `Meta webhook: no ACTIVE ${platform} connection for account ${externalAccountId} — dropping entry`
        );
        continue;
      }

      const mapper =
        platform === 'THREADS' ? this.threadsMapper : this.metaMapper;

      try {
        const event = mapper.toSocialEvent(
          entry,
          connection.id,
          connection.workspaceId
        );
        await this.ingestion.normalizeAndStore(
          event,
          platform,
          connection.id
        );
      } catch (err) {
        // Mapper / IngestionService still throw NOT_IMPLEMENTED in Round A —
        // log and continue so unrelated entries are not blocked.
        this.logger.warn(
          `Meta webhook entry processing failed (${platform}, account=${externalAccountId}): ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // signature verification
  // -------------------------------------------------------------------------

  /**
   * Verifies Meta's `X-Hub-Signature-256` header.
   *
   * Header format: `sha256=<hex>`. Compute HMAC-SHA256 of the raw body with
   * the app secret, hex-encode it, and timing-safe compare against the
   * supplied digest. Returns false on any malformed input.
   */
  private verifySignature(
    rawBody: Buffer,
    headerValue: string,
    appSecret: string
  ): boolean {
    if (!headerValue.startsWith('sha256=')) return false;
    const provided = headerValue.slice('sha256='.length);
    if (!/^[a-f0-9]+$/i.test(provided)) return false;

    const expected = createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    if (provided.length !== expected.length) return false;

    try {
      return timingSafeEqual(
        Buffer.from(provided, 'hex'),
        Buffer.from(expected, 'hex')
      );
    } catch {
      return false;
    }
  }

  /** Length-checked timing-safe string equality. */
  private constantTimeEqualString(a: string, b: string): boolean {
    const ab = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ab.length !== bb.length) return false;
    try {
      return timingSafeEqual(ab, bb);
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// helpers (module-private, exported only for unit tests if added later)
// ---------------------------------------------------------------------------

type MetaPlatformEnum = 'FACEBOOK' | 'INSTAGRAM' | 'THREADS';

function inferPlatform(object: string): MetaPlatformEnum | null {
  switch (object) {
    case 'page':
      return 'FACEBOOK';
    case 'instagram':
      return 'INSTAGRAM';
    case 'threads':
      return 'THREADS';
    default:
      return null;
  }
}

function extractEntryId(entry: unknown): string | null {
  if (
    entry &&
    typeof entry === 'object' &&
    'id' in entry &&
    typeof (entry as { id: unknown }).id === 'string'
  ) {
    return (entry as { id: string }).id;
  }
  return null;
}
