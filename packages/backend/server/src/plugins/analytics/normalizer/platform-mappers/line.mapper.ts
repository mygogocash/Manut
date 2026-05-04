import { Injectable } from '@nestjs/common';

import type { SocialEvent } from '../event.schema';

/**
 * Maps raw LINE Messaging API webhook events into the canonical
 * SocialEvent shape consumed by IngestionService.
 *
 * LINE webhook event reference:
 *   https://developers.line.biz/en/reference/messaging-api/#webhook-event-objects
 *
 * Event types we normalize:
 *   - `message`   → `message.received`
 *   - `follow`    → `follower.gained`
 *   - `unfollow`  → `follower.lost`
 *   - `postback`  → `interaction.postback`
 *   - `beacon`    → `interaction.beacon`
 *   - everything else falls through to `interaction.<type>`
 *
 * The raw payload is preserved verbatim in `raw`. Structured fields
 * useful to the dashboard live in `payload` (e.g. message text, source
 * user/group/room id).
 */

interface LineSource {
  type: 'user' | 'group' | 'room';
  userId?: string;
  groupId?: string;
  roomId?: string;
}

interface LineWebhookEvent {
  type: string;
  timestamp?: number;
  webhookEventId?: string;
  mode?: string;
  source?: LineSource;
  replyToken?: string;
  message?: {
    id?: string;
    type?: string;
    text?: string;
  };
  postback?: {
    data?: string;
    params?: Record<string, unknown>;
  };
  beacon?: {
    hwid?: string;
    type?: string;
  };
  // Catch-all for any unmodeled LINE event field.
  [key: string]: unknown;
}

@Injectable()
export class LineMapper {
  toSocialEvent(
    raw: unknown,
    connectionId: string,
    workspaceId: string
  ): SocialEvent {
    const event = (raw ?? {}) as LineWebhookEvent;
    const eventType = this.mapEventType(event.type);
    const externalId = this.deriveExternalId(event);
    const occurredAt = event.timestamp
      ? new Date(event.timestamp)
      : new Date();

    const payload: Record<string, unknown> = {
      lineEventType: event.type,
      mode: event.mode,
      source: event.source,
    };

    if (event.message) {
      payload.message = {
        id: event.message.id,
        type: event.message.type,
        // Cap text excerpt so we never blow out a single row with a 10k message.
        text:
          typeof event.message.text === 'string'
            ? event.message.text.slice(0, 2000)
            : undefined,
      };
    }
    if (event.postback) {
      payload.postback = event.postback;
    }
    if (event.beacon) {
      payload.beacon = event.beacon;
    }

    return {
      workspaceId,
      connectionId,
      platform: 'LINE_VOOM',
      eventType,
      externalId,
      occurredAt,
      payload,
      raw,
    };
  }

  private mapEventType(lineType: string | undefined): string {
    switch (lineType) {
      case 'message':
        return 'message.received';
      case 'follow':
        return 'follower.gained';
      case 'unfollow':
        return 'follower.lost';
      case undefined:
      case '':
        return 'interaction.unknown';
      default:
        return `interaction.${lineType}`;
    }
  }

  /**
   * LINE doesn't always provide a stable per-event id. Prefer
   * `webhookEventId` (newer field), then a message id, then a
   * synthesized hash of (timestamp + source + type) so we still get
   * dedup on the SocialEvent unique key. Last fallback: random.
   */
  private deriveExternalId(event: LineWebhookEvent): string {
    if (typeof event.webhookEventId === 'string' && event.webhookEventId) {
      return event.webhookEventId;
    }
    if (event.message?.id) {
      return `msg:${event.message.id}`;
    }
    const sourceKey =
      event.source?.userId ??
      event.source?.groupId ??
      event.source?.roomId ??
      'unknown';
    const ts = event.timestamp ?? Date.now();
    return `${event.type ?? 'event'}:${sourceKey}:${ts}`;
  }
}
