import { Avatar } from '@affine/component';
import {
  type Notification,
  NotificationListService,
  NotificationType,
} from '@affine/core/modules/notification';
import {
  FADE_UP_VARIANTS,
  SPRING_GENTLE,
  STAGGER_30MS,
} from '@affine/core/utils/motion';
import type {
  BudgetSoftCapNotificationBodyType,
  InvitationAcceptedNotificationBodyType,
  InvitationBlockedNotificationBodyType,
  InvitationNotificationBodyType,
  InvitationReviewApprovedNotificationBodyType,
  InvitationReviewDeclinedNotificationBodyType,
  InvitationReviewRequestNotificationBodyType,
  MentionNotificationBodyType,
} from '@affine/graphql';
import {
  DoneIcon,
  HidePanelIcon,
  InboxIcon,
  MoreHorizontalIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';

import { bucketByRecency, formatRelativeShort } from './use-recency-buckets';
import * as styles from './views.css';

// Notion-style Inbox panel — flattens the workspace notification stream
// into a recency-bucketed list. Reuses the existing NotificationListService
// (paged loader) so opening the sidebar tab triggers the same fetch the
// notification-center popover uses; data stays consistent across surfaces.
//
// Header actions render as decorative buttons for v1 (visual parity with
// Notion screenshots 4-5). "Mark all read" is wired since the service
// exposes it cheaply; archive/more are placeholders until the dedicated
// inbox actions ship in a follow-up.
export function InboxView(): ReactElement {
  const notificationListService = useService(NotificationListService);

  const notifications = useLiveData(notificationListService.notifications$);
  const isLoading = useLiveData(notificationListService.isLoading$);
  const error = useLiveData(notificationListService.error$);

  // Same load pattern as the notification-center NotificationList — reset
  // on mount so we get a fresh first page, then loadMore once. We don't
  // wire the infinite-scroll observer here; the sidebar is a digest, not
  // the full inbox.
  useLayoutEffect(() => {
    notificationListService.reset();
    notificationListService.loadMore();
  }, [notificationListService]);

  useEffect(() => {
    // No-op cleanup: keep the loaded notifications in the service so
    // re-opening the tab doesn't re-fetch. The service's `reset` above
    // covers stale-state cases when the user actually re-enters.
    return undefined;
  }, []);

  const handleReadAll = useCallback(() => {
    // Read fresh state in the callback — React 19 preserve-manual-
    // memoization means the value captured at memoisation time may be
    // stale. The service guards its own optimistic rollback.
    notificationListService.readAllNotifications().catch(() => undefined);
  }, [notificationListService]);

  const buckets = useMemo(() => {
    return bucketByRecency(
      notifications,
      n => new Date(n.createdAt).getTime(),
      { includeUpcoming: false }
    );
  }, [notifications]);

  // Motion polish — STAGGER_30MS cascade for notification rows.
  // Reduced-motion users see the list render statically (no fade,
  // no movement).
  const prefersReducedMotion = useReducedMotion();
  const listVariants = useMemo(
    () => ({
      hidden: { opacity: 1 },
      visible: {
        opacity: 1,
        transition: prefersReducedMotion ? {} : STAGGER_30MS,
      },
    }),
    [prefersReducedMotion]
  );

  return (
    <div className={styles.viewRoot} data-testid="sidebar-inbox-view">
      <div className={styles.viewHeader}>
        <span>Inbox</span>
        <span className={styles.viewHeaderActions}>
          <button
            type="button"
            className={styles.headerActionButton}
            onClick={handleReadAll}
            disabled={notifications.length === 0}
            aria-label="Mark all as read"
            data-testid="sidebar-inbox-mark-all-read"
          >
            <DoneIcon />
          </button>
          <button
            type="button"
            className={styles.headerActionButton}
            disabled
            aria-label="Archive"
            data-testid="sidebar-inbox-archive"
          >
            <HidePanelIcon />
          </button>
          <button
            type="button"
            className={styles.headerActionButton}
            disabled
            aria-label="More"
            data-testid="sidebar-inbox-more"
          >
            <MoreHorizontalIcon />
          </button>
        </span>
      </div>
      <div className={styles.viewBody}>
        {notifications.length === 0 ? (
          isLoading ? (
            <div className={styles.skeletonRow}>Loading…</div>
          ) : error ? (
            <div className={styles.errorText}>
              {String((error as { message?: string })?.message ?? error)}
            </div>
          ) : (
            <InboxEmptyState />
          )
        ) : (
          <motion.div
            variants={listVariants}
            initial={prefersReducedMotion ? false : 'hidden'}
            animate="visible"
          >
            {buckets.map(bucket => (
              <div key={bucket.bucket.id}>
                <div
                  className={styles.groupLabel}
                  data-testid={`sidebar-inbox-bucket-${bucket.bucket.id}`}
                >
                  {bucket.bucket.label}
                </div>
                {bucket.items.map(notification => (
                  <motion.div
                    key={notification.id}
                    variants={
                      prefersReducedMotion ? undefined : FADE_UP_VARIANTS
                    }
                    transition={
                      prefersReducedMotion ? { duration: 0 } : SPRING_GENTLE
                    }
                  >
                    <NotificationRow notification={notification} />
                  </motion.div>
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function InboxEmptyState(): ReactElement {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <InboxIcon />
      </div>
      <div className={styles.emptyTitle}>Inbox zero</div>
      <div className={styles.emptyCopy}>
        Mentions, invitations, and updates will show up here.
      </div>
    </div>
  );
}

interface NotificationRowProps {
  notification: Notification;
}

function NotificationRow({ notification }: NotificationRowProps): ReactElement {
  const { actorName, summary } = describeNotification(notification);
  const createdMs = new Date(notification.createdAt).getTime();
  const relative = formatRelativeShort(createdMs);
  const avatarName = actorName ?? 'AFFiNE';
  const avatarUrl = pickAvatarUrl(notification);

  return (
    <div className={styles.row} data-testid="sidebar-inbox-row">
      <span className={styles.rowAvatar}>
        <Avatar size={20} name={avatarName} url={avatarUrl} />
      </span>
      <div className={styles.rowMain}>
        <div className={styles.rowTitle}>{actorName ?? avatarName}</div>
        <div className={styles.rowSubtitle}>{summary}</div>
      </div>
      <div className={styles.rowMeta}>{relative}</div>
    </div>
  );
}

// Pure: derive an actor name + one-line summary from a notification's
// typed body. We keep this in the file so the rendering pipeline is a
// straight read-from-data-to-pixels — no Trans interpolation, no
// per-type sub-components, no router deps. Matches the Notion compact
// row look ("Alice invited you" / "Bob mentioned you in Doc").
function describeNotification(notification: Notification): {
  actorName: string | undefined;
  summary: string;
} {
  const body = notification.body as
    | MentionNotificationBodyType
    | InvitationNotificationBodyType
    | InvitationAcceptedNotificationBodyType
    | InvitationBlockedNotificationBodyType
    | InvitationReviewRequestNotificationBodyType
    | InvitationReviewDeclinedNotificationBodyType
    | InvitationReviewApprovedNotificationBodyType
    | BudgetSoftCapNotificationBodyType
    | undefined;
  const actorName = body?.createdByUser?.name ?? undefined;
  const workspaceName =
    'workspace' in (body ?? {}) ? body?.workspace?.name : undefined;
  const docTitle =
    'doc' in (body ?? {})
      ? (body as MentionNotificationBodyType | undefined)?.doc?.title
      : undefined;

  switch (notification.type) {
    case NotificationType.Mention:
      return {
        actorName,
        summary: `mentioned you${docTitle ? ` in ${docTitle}` : ''}`,
      };
    case NotificationType.Comment:
      return {
        actorName,
        summary: `commented${docTitle ? ` on ${docTitle}` : ''}`,
      };
    case NotificationType.CommentMention:
      return {
        actorName,
        summary: `mentioned you in a comment${docTitle ? ` on ${docTitle}` : ''}`,
      };
    case NotificationType.Invitation:
      return {
        actorName,
        summary: `invited you${workspaceName ? ` to ${workspaceName}` : ''}`,
      };
    case NotificationType.InvitationAccepted:
      return {
        actorName,
        summary: `accepted your invitation${workspaceName ? ` to ${workspaceName}` : ''}`,
      };
    case NotificationType.InvitationBlocked:
      return {
        actorName: actorName ?? 'Workspace',
        summary: `invitation blocked${workspaceName ? ` in ${workspaceName}` : ''}`,
      };
    case NotificationType.InvitationReviewRequest:
      return {
        actorName,
        summary: `requested review${workspaceName ? ` in ${workspaceName}` : ''}`,
      };
    case NotificationType.InvitationReviewApproved:
      return {
        actorName,
        summary: `approved your request${workspaceName ? ` for ${workspaceName}` : ''}`,
      };
    case NotificationType.InvitationReviewDeclined:
      return {
        actorName,
        summary: `declined your request${workspaceName ? ` for ${workspaceName}` : ''}`,
      };
    case NotificationType.BudgetSoftCap:
      return {
        actorName: 'AFFiNE',
        summary: `budget alert${workspaceName ? ` in ${workspaceName}` : ''}`,
      };
    default:
      return {
        actorName: actorName ?? 'AFFiNE',
        summary: 'New notification',
      };
  }
}

function pickAvatarUrl(notification: Notification): string | undefined {
  const body = notification.body as
    | MentionNotificationBodyType
    | InvitationNotificationBodyType
    | undefined;
  return body?.createdByUser?.avatarUrl ?? undefined;
}
