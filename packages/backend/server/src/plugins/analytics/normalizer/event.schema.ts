/**
 * SocialEvent — normalized event shape produced by platform mappers.
 *
 * NOT a Prisma model — that lives in schema.prisma (owned by agent 1).
 * This is the in-memory shape ingestion.service.ts builds before persisting.
 */

export type SocialPlatformName =
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'THREADS'
  | 'TIKTOK'
  | 'LINE_VOOM'
  | 'GOGOCASH';

export interface SocialEvent {
  workspaceId: string;
  connectionId: string;
  platform: SocialPlatformName;
  /**
   * Canonical event type — namespaced like `post.created`, `comment.added`,
   * `follower.gained`, `metric.snapshot`, …
   */
  eventType: string;
  /** Platform-native id used for dedup with @@unique[connectionId, externalId, eventType]. */
  externalId: string;
  occurredAt: Date;
  /** Normalized fields (engagement counts, content excerpt, etc.). */
  payload: Record<string, unknown>;
  /** Original webhook / API body, preserved for debugging and replay. */
  raw: unknown;
}
