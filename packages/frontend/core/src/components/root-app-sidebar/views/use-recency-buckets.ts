import {
  pickTimeBucket,
  type TimeBucketId,
} from '@affine/core/modules/quicksearch/components/result-group';

// Pure helpers for grouping items by recency in the sidebar Meetings /
// Inbox views. Builds on the existing `pickTimeBucket` (E2.3) so the
// bucket boundaries stay consistent with cmdk results. Sidebar adds an
// `upcoming` bucket on top — for meetings starting in the future. Past
// buckets reuse `pickTimeBucket` verbatim.
//
// Kept dependency-free (no React, no rxjs, no vanilla-extract) so this
// module is safe to import from anywhere — including `.css.ts` siblings —
// and trivially testable in isolation (CLAUDE.md §1).

export type RecencyBucketId = 'upcoming' | TimeBucketId;

export interface RecencyBucket {
  id: RecencyBucketId;
  label: string;
  order: number;
}

const BUCKET_LABELS: Record<RecencyBucketId, string> = {
  upcoming: 'Upcoming',
  today: 'Today',
  yesterday: 'Yesterday',
  'past-7-days': 'Past 7 days',
  'past-30-days': 'Past 30 days',
  older: 'Older',
  undated: 'Other',
};

const BUCKET_ORDER: RecencyBucketId[] = [
  'upcoming',
  'today',
  'yesterday',
  'past-7-days',
  'past-30-days',
  'older',
  'undated',
];

const BUCKET_ORDER_INDEX: ReadonlyMap<RecencyBucketId, number> = new Map(
  BUCKET_ORDER.map((id, idx) => [id, idx])
);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Pure: pick a bucket for a timestamp relative to `now`. Forward-looking
// timestamps (strictly in the future, but not on today's calendar day) go
// to `upcoming`; everything else delegates to `pickTimeBucket`. We
// special-case "today but later" as today rather than upcoming — that
// keeps the bucket boundaries aligned with how a user actually thinks
// about their day.
export function pickRecencyBucket(
  timestamp: number | undefined,
  now: number = Date.now()
): RecencyBucketId {
  if (!timestamp || !Number.isFinite(timestamp)) return 'undated';
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const tomorrow = startOfToday.getTime() + MS_PER_DAY;
  if (timestamp >= tomorrow) return 'upcoming';
  return pickTimeBucket(timestamp, now);
}

export interface BucketedItem<T> {
  bucket: RecencyBucket;
  items: T[];
}

export interface BucketRecencyOptions {
  // Strip the upcoming bucket — used by the Inbox view, where nothing is
  // ever in the future.
  includeUpcoming?: boolean;
  // Inject `now` so callers can pin a clock for unit tests.
  now?: number;
}

// Pure: group items into recency buckets, preserving the original order
// within each bucket. Empty buckets are omitted from the result. Buckets
// are returned in the canonical order defined by `BUCKET_ORDER`.
export function bucketByRecency<T>(
  items: ReadonlyArray<T>,
  getTimestamp: (item: T) => number | undefined,
  options: BucketRecencyOptions = {}
): BucketedItem<T>[] {
  const { includeUpcoming = true, now = Date.now() } = options;
  if (items.length === 0) return [];

  const grouped = new Map<RecencyBucketId, T[]>();
  for (const item of items) {
    let bucketId = pickRecencyBucket(getTimestamp(item), now);
    if (!includeUpcoming && bucketId === 'upcoming') {
      // Fold any stray "upcoming" entries into today when the consumer
      // doesn't want a future tier (e.g. Inbox view).
      bucketId = 'today';
    }
    const existing = grouped.get(bucketId);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(bucketId, [item]);
    }
  }

  const buckets: BucketedItem<T>[] = [];
  for (const id of BUCKET_ORDER) {
    if (!includeUpcoming && id === 'upcoming') continue;
    const bucketItems = grouped.get(id);
    if (!bucketItems || bucketItems.length === 0) continue;
    buckets.push({
      bucket: {
        id,
        label: BUCKET_LABELS[id],
        order: BUCKET_ORDER_INDEX.get(id) ?? 0,
      },
      items: bucketItems,
    });
  }
  return buckets;
}

// Pure: format a short relative time string (Notion-style) for a row's
// right-side caption. Forward-looking → "in 2h", "in 3d"; past → "5m",
// "2h", "3d", "Mar 4". Caps at month-day after a year. `now` is injectable
// for test pinning.
export function formatRelativeShort(
  timestamp: number | undefined,
  now: number = Date.now()
): string {
  if (!timestamp || !Number.isFinite(timestamp)) return '';
  const diffMs = timestamp - now;
  const absMs = Math.abs(diffMs);
  const minutes = Math.round(absMs / (60 * 1000));
  const hours = Math.round(absMs / (60 * 60 * 1000));
  const days = Math.round(absMs / MS_PER_DAY);
  const isFuture = diffMs > 0;
  const prefix = isFuture ? 'in ' : '';

  if (absMs < 60 * 1000) return isFuture ? 'soon' : 'now';
  if (minutes < 60) return `${prefix}${minutes}m`;
  if (hours < 24) return `${prefix}${hours}h`;
  if (days < 7) return `${prefix}${days}d`;
  if (days < 365) {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
