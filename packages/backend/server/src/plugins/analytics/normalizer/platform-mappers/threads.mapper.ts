import { Injectable } from '@nestjs/common';

import type { SocialEvent } from '../event.schema';

/**
 * Maps raw Threads webhook entries (and poll-derived entry-shaped payloads)
 * into the canonical SocialEvent shape.
 *
 * Threads' webhook surface is much smaller than Facebook's — at the time of
 * writing, the documented fields under `object: 'threads'` are:
 *   - `replies` (a reply was posted to one of our threads)
 *   - `mentions` (we were mentioned)
 *
 * The brief asks us to also map:
 *   - new thread → post.created
 *   - reply      → comment.added
 *   - repost     → share.received
 *
 * Threads doesn't push "new thread by self" via webhook (that's the user's
 * own action), but the poll-first path produces entries with a `media_id`
 * and `media_product_type=THREADS` — we map those to `post.created` so the
 * AI strategist sees the same event whether it came from poll or webhook.
 *
 * Coverage matrix:
 *   - replies / reply field     → comment.added
 *   - mentions field            → mention.received
 *   - reposts (when surfaced)   → share.received
 *   - new media (poll path)     → post.created
 *   - anything else             → metric.snapshot
 */

interface ThreadsEntry {
  id?: string;
  time?: number;
  changes?: Array<{
    field?: string;
    value?: Record<string, unknown>;
  }>;
  // Poll-shape: when we synthesize entries from the polling endpoint we
  // attach the media object directly so the same mapper handles both paths.
  media?: Record<string, unknown>;
}

@Injectable()
export class ThreadsMapper {
  toSocialEvent(
    raw: unknown,
    connectionId: string,
    workspaceId: string
  ): SocialEvent {
    const entry = (raw ?? {}) as ThreadsEntry;
    const change = entry.changes?.[0];
    const field = typeof change?.field === 'string' ? change.field : '';
    const value =
      change?.value && typeof change.value === 'object' ? change.value : {};

    const eventType = mapThreadsField(field, value, entry);
    const externalId = extractExternalId(entry, value);
    const occurredAt = extractOccurredAt(entry, value);

    return {
      workspaceId,
      connectionId,
      platform: 'THREADS',
      eventType,
      externalId,
      occurredAt,
      payload: normalizePayload(field, value, entry),
      raw,
    };
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function mapThreadsField(
  field: string,
  value: Record<string, unknown>,
  entry: ThreadsEntry
): string {
  if (field === 'replies' || field === 'reply') return 'comment.added';
  if (field === 'mentions' || field === 'mention') return 'mention.received';
  if (field === 'reposts' || field === 'repost') return 'share.received';

  // Detect repost-shaped values that some webhook variants ship under a
  // generic 'thread' field.
  const verb = typeof value.verb === 'string' ? value.verb : '';
  if (verb === 'repost') return 'share.received';
  if (verb === 'reply') return 'comment.added';
  if (verb === 'mention') return 'mention.received';

  // Poll-derived entries.
  if (entry.media || value.media_product_type === 'THREADS') {
    return 'post.created';
  }

  return 'metric.snapshot';
}

function extractExternalId(
  entry: ThreadsEntry,
  value: Record<string, unknown>
): string {
  const candidates = [
    value.media_id,
    value.thread_id,
    value.reply_id,
    value.repost_id,
    value.id,
    entry.media && typeof entry.media === 'object'
      ? (entry.media as { id?: unknown }).id
      : undefined,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  if (entry.id && entry.time) return `${entry.id}-${entry.time}`;
  return entry.id ?? `threads-${Date.now()}`;
}

function extractOccurredAt(
  entry: ThreadsEntry,
  value: Record<string, unknown>
): Date {
  const created =
    typeof value.timestamp === 'string'
      ? Date.parse(value.timestamp)
      : typeof value.created_time === 'string'
        ? Date.parse(value.created_time)
        : NaN;
  if (!Number.isNaN(created)) return new Date(created);
  if (typeof entry.time === 'number') return new Date(entry.time * 1000);
  return new Date();
}

function normalizePayload(
  field: string,
  value: Record<string, unknown>,
  entry: ThreadsEntry
): Record<string, unknown> {
  const out: Record<string, unknown> = { field };
  for (const k of [
    'media_id',
    'thread_id',
    'reply_id',
    'repost_id',
    'verb',
    'text',
    'permalink',
    'username',
    'sender_id',
    'media_product_type',
    'timestamp',
    'created_time',
  ]) {
    if (k in value) out[k] = value[k];
  }
  if (entry.media && typeof entry.media === 'object') {
    out.media = entry.media;
  }
  return out;
}
