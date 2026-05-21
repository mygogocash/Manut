import type { ReactNode } from 'react';
export type TimeBucketId = 'today' | 'yesterday' | 'past-7-days' | 'past-30-days' | 'older' | 'undated';
export interface TimeBucket {
    id: TimeBucketId;
    label: string;
    order: number;
}
export declare const TIME_BUCKETS: ReadonlyArray<TimeBucket>;
export declare function pickTimeBucket(timestamp: number | undefined, now?: number): TimeBucketId;
export interface ResultGroupHeadingProps {
    bucketId: TimeBucketId;
    count: number;
    children?: ReactNode;
}
export declare function ResultGroupHeading({ bucketId, count, }: ResultGroupHeadingProps): ReactNode;
//# sourceMappingURL=result-group.d.ts.map