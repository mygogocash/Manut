import { Injectable } from '@nestjs/common';

import type {
  SocialEvent,
  SocialPlatformName,
} from '../event.schema';

/**
 * Maps raw Meta (Facebook Page + Instagram Business) webhook entries into
 * the canonical SocialEvent shape.
 *
 * One entry from Meta may carry multiple `changes`. The MetaWebhookController
 * passes the whole entry; we surface the FIRST change as the event payload
 * (PRD's @@unique[connectionId, externalId, eventType] handles dedup, so a
 * "primary" change per entry is good enough for v1; multi-change splitting
 * can land later without breaking callers).
 *
 * Coverage matrix:
 *   FACEBOOK:
 *     - feed (verb=add)         → post.created
 *     - feed (verb=edited)      → post.updated
 *     - feed (other verbs)      → comment.added (covers comment/reply verbs)
 *     - mention                 → mention.received
 *     - any unknown field       → metric.snapshot (defensive default)
 *   INSTAGRAM:
 *     - comments                → comment.added
 *     - mentions                → mention.received
 *     - story_insights          → story.insights_updated
 *     - any unknown field       → metric.snapshot
 */

interface MetaEntry {
  id?: string;
  time?: number;
  uid?: string;
  changes?: Array<{
    field?: string;
    value?: Record<string, unknown>;
  }>;
}

@Injectable()
export class MetaMapper {
  toSocialEvent(
    raw: unknown,
    connectionId: string,
    workspaceId: string
  ): SocialEvent {
    const entry = (raw ?? {}) as MetaEntry;
    const change = entry.changes?.[0];
    const field = typeof change?.field === 'string' ? change.field : '';
    const value =
      change?.value && typeof change.value === 'object'
        ? change.value
        : {};

    // Platform inference: Instagram entries arrive under `object: 'instagram'`
    // in the parent body. The controller already routes IG entries to this
    // mapper; we just need to detect "is this an IG-shaped change" by field
    // name. IG fields: comments, mentions, story_insights. Everything else
    // we treat as Facebook.
    const platform: Extract<SocialPlatformName, 'FACEBOOK' | 'INSTAGRAM'> =
      isInstagramField(field) ? 'INSTAGRAM' : 'FACEBOOK';

    const eventType =
      platform === 'INSTAGRAM'
        ? mapInstagramField(field)
        : mapFacebookField(field, value);

    const externalId = extractExternalId(entry, value);
    const occurredAt = extractOccurredAt(entry, value);

    return {
      workspaceId,
      connectionId,
      platform,
      eventType,
      externalId,
      occurredAt,
      payload: normalizePayload(field, value),
      raw,
    };
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function isInstagramField(field: string): boolean {
  return (
    field === 'comments' ||
    field === 'mentions' ||
    field === 'story_insights'
  );
}

function mapInstagramField(field: string): string {
  switch (field) {
    case 'comments':
      return 'comment.added';
    case 'mentions':
      return 'mention.received';
    case 'story_insights':
      return 'story.insights_updated';
    default:
      return 'metric.snapshot';
  }
}

function mapFacebookField(
  field: string,
  value: Record<string, unknown>
): string {
  if (field === 'mention') return 'mention.received';

  if (field === 'feed') {
    const verb = typeof value.verb === 'string' ? value.verb : '';
    const item = typeof value.item === 'string' ? value.item : '';
    if (verb === 'add' && (item === 'status' || item === 'post' || item === 'photo' || item === 'video')) {
      return 'post.created';
    }
    if (verb === 'edited') return 'post.updated';
    // comment / reply / like verbs → treat as comment-style activity.
    if (item === 'comment' || verb === 'add') return 'comment.added';
    return 'post.updated';
  }

  return 'metric.snapshot';
}

function extractExternalId(
  entry: MetaEntry,
  value: Record<string, unknown>
): string {
  // Prefer the most specific id we have so the dedup unique index does its
  // job. Fall back to `entry.id-time` if the change carries no item id.
  const candidates = [
    value.post_id,
    value.comment_id,
    value.media_id,
    value.mention_id,
    value.id,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  if (entry.id && entry.time) {
    return `${entry.id}-${entry.time}`;
  }
  return entry.id ?? `meta-${Date.now()}`;
}

function extractOccurredAt(
  entry: MetaEntry,
  value: Record<string, unknown>
): Date {
  const created =
    typeof value.created_time === 'string'
      ? Date.parse(value.created_time)
      : NaN;
  if (!Number.isNaN(created)) return new Date(created);
  if (typeof entry.time === 'number') {
    return new Date(entry.time * 1000);
  }
  return new Date();
}

function normalizePayload(
  field: string,
  value: Record<string, unknown>
): Record<string, unknown> {
  // Pull through the most useful flat fields. We deliberately copy rather
  // than spread `value` to keep the payload predictable for downstream
  // consumers; the full body is preserved on `raw`.
  const out: Record<string, unknown> = { field };
  for (const k of [
    'verb',
    'item',
    'message',
    'post_id',
    'comment_id',
    'media_id',
    'mention_id',
    'sender_id',
    'sender_name',
    'permalink',
    'permalink_url',
    'created_time',
    'parent_id',
    'reaction_type',
  ]) {
    if (k in value) out[k] = value[k];
  }
  return out;
}
