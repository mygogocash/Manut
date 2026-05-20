import { WorkspaceServerService } from '@affine/core/modules/cloud';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { IntegrationService } from '@affine/core/modules/integration';
import { TodayIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import dayjs from 'dayjs';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import { CALENDAR_INTEGRATION_SCROLL_ANCHOR } from '../../../desktop/dialogs/setting/navigation-constants';
import { bucketByRecency, formatRelativeShort } from './use-recency-buckets';
import * as styles from './views.css';

// Window we keep loaded for the sidebar list. 14 past days + 30 upcoming
// days gives enough to populate every bucket (Yesterday / Past 7 days /
// Past 30 days / Upcoming) without paging through months. The journal
// page already revalidates the broader month-by-month range; we just need
// a rolling slice here.
const PAST_WINDOW_DAYS = 30;
const FUTURE_WINDOW_DAYS = 30;

// Five-minute revalidation cadence matches the journal calendar so the
// two views show the same data without competing requests (CLAUDE.md §1.1
// FIRST/repeatable).
const REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;

// Notion-style Meetings panel — flattens the calendar entity's event map
// across a rolling window into a single list, grouped by recency. Falls
// back to a connect-Google-Calendar empty state when no accounts are
// linked, with a button that deep-links into Settings → Account →
// Integrations and scrolls to the calendar block.
export function MeetingsView(): ReactElement {
  const integration = useService(IntegrationService);
  const calendar = integration.calendar;
  const workspaceServerService = useService(WorkspaceServerService);
  const workspaceDialogService = useService(WorkspaceDialogService);

  // Read fresh server reference on every render — useLiveData triggers a
  // re-render whenever the server-bound observable emits, so the loader
  // effects below see the current server (React 19 preserve-manual-
  // memoization: never close over a stale value in a callback). The
  // service may already be torn down between renders; the loader effects
  // tolerate undefined gracefully.
  const server = useLiveData(workspaceServerService.server$);
  const accounts = useLiveData(calendar.accounts$);
  const eventsByDateMap = useLiveData(calendar.eventsByDateMap$);
  const workspaceCalendars = useLiveData(calendar.workspaceCalendars$);

  // Initial load: hydrate accounts + workspace calendars. Idempotent —
  // the underlying gql queries deduplicate.
  useEffect(() => {
    calendar.revalidateWorkspaceCalendars().catch(() => undefined);
    calendar.loadAccountCalendars().catch(() => undefined);
  }, [calendar, server]);

  // Rolling event window. Refresh every 5 minutes so the upcoming list
  // stays current without driving a request on every render.
  useEffect(() => {
    const update = () => {
      const start = dayjs().subtract(PAST_WINDOW_DAYS, 'day');
      const end = dayjs().add(FUTURE_WINDOW_DAYS, 'day');
      calendar.revalidateEventsRange(start, end).catch(() => undefined);
    };
    update();
    const interval = setInterval(update, REVALIDATE_INTERVAL_MS);
    return () => clearInterval(interval);
    // We deliberately leave `calendar` as the only dep — `workspaceCalendars`
    // would re-trigger the loader on every fetch and create a feedback
    // loop. The 5-minute cadence is enough on its own.
  }, [calendar]);

  const isConnected = accounts.length > 0;

  // Flatten the per-day event map into a single de-duplicated list.
  // Multi-day events appear under every day they span (the integration
  // entity replicates them on purpose for grid layouts); we dedupe by
  // event id so the sidebar shows them once.
  const subscriptionInfoById = useMemo(() => {
    const lookup = new Map<
      string,
      { name: string; color: string | null | undefined }
    >();
    // Walk the workspaceCalendars and their items to figure out per-
    // subscription color override. Falls back to the integration
    // entity's `eventsByDate$` shape — but that one needs a Dayjs and
    // works per-day; here we just need the raw color hint.
    for (const wsCal of workspaceCalendars) {
      for (const item of wsCal.items ?? []) {
        lookup.set(item.subscriptionId, {
          name: '',
          color: item.colorOverride,
        });
      }
    }
    return lookup;
  }, [workspaceCalendars]);

  const flattenedEvents = useMemo(() => {
    if (eventsByDateMap.size === 0) return [];
    const seen = new Set<string>();
    type FlatEvent = {
      id: string;
      title: string;
      startMs: number;
      color: string | null | undefined;
      allDay: boolean;
    };
    const out: FlatEvent[] = [];
    for (const events of eventsByDateMap.values()) {
      for (const event of events) {
        if (seen.has(event.id)) continue;
        seen.add(event.id);
        const startMs = new Date(event.startAtUtc).getTime();
        if (!Number.isFinite(startMs)) continue;
        const info = subscriptionInfoById.get(event.subscriptionId);
        out.push({
          id: event.id,
          title: event.title ?? '',
          startMs,
          color: info?.color,
          allDay: event.allDay,
        });
      }
    }
    // Sort: upcoming earliest first, past most-recent first. We do this
    // by sorting by absolute distance from `now`, with a tiebreak that
    // future events come before past ones at the same distance.
    out.sort((a, b) => b.startMs - a.startMs);
    return out;
  }, [eventsByDateMap, subscriptionInfoById]);

  const buckets = useMemo(() => {
    return bucketByRecency(flattenedEvents, item => item.startMs, {
      includeUpcoming: true,
    });
  }, [flattenedEvents]);

  // Re-sort upcoming ascending (soonest first) — the global sort above
  // was descending so past rows are recency-ordered. Buckets keep their
  // internal order, so we patch the upcoming bucket here.
  const orderedBuckets = useMemo(() => {
    return buckets.map(bucket => {
      if (bucket.bucket.id !== 'upcoming') return bucket;
      return {
        ...bucket,
        items: [...bucket.items].sort((a, b) => a.startMs - b.startMs),
      };
    });
  }, [buckets]);

  const handleConnect = useCallback(() => {
    workspaceDialogService.open('setting', {
      activeTab: 'account',
      scrollAnchor: CALENDAR_INTEGRATION_SCROLL_ANCHOR,
    });
  }, [workspaceDialogService]);

  if (!isConnected) {
    return (
      <div className={styles.viewRoot} data-testid="sidebar-meetings-view">
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <TodayIcon />
          </div>
          <div className={styles.emptyTitle}>No meetings yet</div>
          <div className={styles.emptyCopy}>
            Connect Google Calendar to see your meetings.
          </div>
          <button
            type="button"
            className={styles.emptyAction}
            onClick={handleConnect}
            data-testid="sidebar-meetings-connect-button"
          >
            Connect Google Calendar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.viewRoot} data-testid="sidebar-meetings-view">
      <div className={styles.viewHeader}>
        <span>Meetings</span>
      </div>
      <div className={styles.viewBody}>
        {orderedBuckets.length === 0 ? (
          <div className={styles.skeletonRow}>No meetings in this window.</div>
        ) : (
          orderedBuckets.map(bucket => (
            <div key={bucket.bucket.id}>
              <div
                className={styles.groupLabel}
                data-testid={`sidebar-meetings-bucket-${bucket.bucket.id}`}
              >
                {bucket.bucket.label}
              </div>
              {bucket.items.map(event => (
                <MeetingRow
                  key={event.id}
                  title={event.title}
                  startMs={event.startMs}
                  color={event.color}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface MeetingRowProps {
  title: string;
  startMs: number;
  color: string | null | undefined;
}

function MeetingRow({ title, startMs, color }: MeetingRowProps): ReactElement {
  const displayTitle = title || '(no title)';
  const relative = formatRelativeShort(startMs);
  return (
    <div className={styles.row} data-testid="sidebar-meetings-row">
      <span
        className={styles.rowDot}
        style={color ? { background: color } : undefined}
        aria-hidden="true"
      />
      <span className={styles.rowIcon}>
        <TodayIcon />
      </span>
      <div className={styles.rowMain}>
        <div className={styles.rowTitle}>{displayTitle}</div>
      </div>
      <div className={styles.rowMeta}>{relative}</div>
    </div>
  );
}
