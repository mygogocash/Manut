import { Injectable } from '@nestjs/common';
import type { SocialConnection } from '@prisma/client';

import type { SocialEvent } from '../event.schema';

/**
 * TikTok payload normalizer (Display-API tier).
 *
 * Two entry points:
 *   - toSocialEvent: a video discovered by the 15-min poller (post.created).
 *   - toFailedUploadEvent: the only webhook tier we support — video.upload.failed.
 *
 * Per PRD risk #12: there is NO video.publish webhook on the Display-API tier;
 * publish detection is poller-driven.
 */

interface TikTokVideoRaw {
  id?: string | number;
  create_time?: number;
  cover_image_url?: string;
  share_url?: string;
  video_description?: string;
  duration?: number;
  height?: number;
  width?: number;
  title?: string;
  embed_html?: string;
  embed_link?: string;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
}

@Injectable()
export class TikTokMapper {
  /**
   * Map a single video object (from /v2/video/list/ or /v2/video/query/)
   * into a `post.created` SocialEvent. Metric counts may be absent on the
   * list endpoint and filled in by a follow-up query call.
   */
  toSocialEvent(
    rawVideo: TikTokVideoRaw,
    connection: Pick<SocialConnection, 'id' | 'workspaceId'>
  ): SocialEvent {
    const externalId = String(rawVideo.id ?? '');
    if (!externalId) {
      throw new Error('TikTokMapper.toSocialEvent: video.id is required');
    }

    const occurredAt =
      typeof rawVideo.create_time === 'number'
        ? new Date(rawVideo.create_time * 1000)
        : new Date();

    const payload: Record<string, unknown> = {
      externalId,
      title: rawVideo.title ?? '',
      description: rawVideo.video_description ?? '',
      shareUrl: rawVideo.share_url ?? '',
      coverImageUrl: rawVideo.cover_image_url ?? '',
      embedLink: rawVideo.embed_link ?? '',
      duration: rawVideo.duration ?? null,
      width: rawVideo.width ?? null,
      height: rawVideo.height ?? null,
      metrics: {
        viewCount: rawVideo.view_count ?? 0,
        likeCount: rawVideo.like_count ?? 0,
        commentCount: rawVideo.comment_count ?? 0,
        shareCount: rawVideo.share_count ?? 0,
      },
    };

    return {
      workspaceId: connection.workspaceId,
      connectionId: connection.id,
      platform: 'TIKTOK',
      eventType: 'post.created',
      externalId,
      occurredAt,
      payload,
      raw: rawVideo,
    };
  }

  /**
   * Map a `video.upload.failed` webhook body to a SocialEvent. The webhook
   * does not carry an external video id (the upload failed), so the
   * `externalId` is synthesized from the user open_id + create_time so the
   * @@unique[connectionId, externalId, eventType] constraint still dedupes
   * a duplicated webhook delivery.
   */
  toFailedUploadEvent(
    webhookBody: Record<string, unknown>,
    connection: Pick<SocialConnection, 'id' | 'workspaceId'>
  ): SocialEvent {
    const user = (webhookBody.user as { open_id?: string } | undefined) ?? {};
    const openId =
      user.open_id ?? (webhookBody.user_openid as string | undefined) ?? '';
    const createTime =
      (webhookBody.create_time as number | undefined) ??
      Math.floor(Date.now() / 1000);

    const externalId = `upload-failed:${openId || 'unknown'}:${createTime}`;
    const occurredAt = new Date(createTime * 1000);

    const content = webhookBody.content;
    const reason =
      typeof content === 'string'
        ? content
        : (content as { reason?: string } | undefined)?.reason ?? null;

    const payload: Record<string, unknown> = {
      openId,
      reason,
    };

    return {
      workspaceId: connection.workspaceId,
      connectionId: connection.id,
      platform: 'TIKTOK',
      eventType: 'video.upload.failed',
      externalId,
      occurredAt,
      payload,
      raw: webhookBody,
    };
  }
}
