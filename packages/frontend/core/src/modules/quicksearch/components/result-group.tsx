import type { ReactNode } from 'react';

import * as styles from './result-group.css';

// Time-bucket grouping (Today / Yesterday / Past 7 days / Past 30 days /
// Older) per IMPLEMENTATION_PLAN.md §B4. Pure helpers — testable in
// isolation (CLAUDE.md §1: utilities live in clean modules).

export type TimeBucketId =
  | 'today'
  | 'yesterday'
  | 'past-7-days'
  | 'past-30-days'
  | 'older'
  | 'undated';

export interface TimeBucket {
  id: TimeBucketId;
  label: string;
  order: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const TIME_BUCKETS: ReadonlyArray<TimeBucket> = [
  { id: 'today', label: 'Today', order: 0 },
  { id: 'yesterday', label: 'Yesterday', order: 1 },
  { id: 'past-7-days', label: 'Past 7 days', order: 2 },
  { id: 'past-30-days', label: 'Past 30 days', order: 3 },
  { id: 'older', label: 'Older', order: 4 },
  { id: 'undated', label: 'Other', order: 5 },
];

// Pure: pick the bucket for a given timestamp relative to `now`.
// `now` is injectable so unit tests don't depend on Date.now().
export function pickTimeBucket(
  timestamp: number | undefined,
  now: number = Date.now()
): TimeBucketId {
  if (!timestamp || !Number.isFinite(timestamp)) return 'undated';
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();
  const yesterday = today - MS_PER_DAY;
  const sevenDaysAgo = today - 7 * MS_PER_DAY;
  const thirtyDaysAgo = today - 30 * MS_PER_DAY;

  if (timestamp >= today) return 'today';
  if (timestamp >= yesterday) return 'yesterday';
  if (timestamp >= sevenDaysAgo) return 'past-7-days';
  if (timestamp >= thirtyDaysAgo) return 'past-30-days';
  return 'older';
}

export interface ResultGroupHeadingProps {
  bucketId: TimeBucketId;
  count: number;
  children?: ReactNode;
}

export function ResultGroupHeading({
  bucketId,
  count,
}: ResultGroupHeadingProps): ReactNode {
  if (count === 0) return null;
  const bucket = TIME_BUCKETS.find(b => b.id === bucketId);
  if (!bucket) return null;
  return (
    <div
      className={styles.groupHeading}
      data-testid={`cmdk-time-bucket-${bucketId}`}
    >
      {bucket.label}
    </div>
  );
}
