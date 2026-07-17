"use client";

import { formatDistanceToNow } from "date-fns";
import { CloudOff, HardDrive, ShieldAlert } from "lucide-react";

import { formatBytes } from "@/components/admin/usage/format-bytes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { BucketHealth } from "@/services/admin-usage.service";

interface BucketHealthCardProps {
  data: BucketHealth | null;
  loading?: boolean;
}

export function BucketHealthCard({ data, loading }: BucketHealthCardProps) {
  if (loading) {
    return <Skeleton className="h-[200px] rounded-xl" />;
  }

  if (!data || data.buckets.length === 0) {
    return (
      <Card className="border-border/80 bg-card/80">
        <CardContent className="flex items-center gap-3 p-5">
          <CloudOff className="text-muted-foreground size-5" />
          <div>
            <div className="text-sm font-semibold">No bucket snapshot yet</div>
            <p className="text-muted-foreground text-xs">
              The Supabase storage snapshot cron has not run. Trigger
              <code className="bg-muted mx-1 rounded px-1 py-0.5 text-[11px]">
                POST /api/cron/sync-storage-snapshot
              </code>
              with the cron secret to populate this card.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const orphanShare =
    data.bucketTotalBytes > 0
      ? data.unaccountedBytes / data.bucketTotalBytes
      : 0;

  return (
    <Card className="border-border/80 bg-card/80 overflow-hidden">
      <CardHeader
        className={`
          border-border/60 flex-row items-center justify-between gap-2 border-b
          pb-3
        `}
      >
        <div>
          <CardTitle className="text-sm font-semibold">Bucket health</CardTitle>
          <CardDescription className="text-xs">
            Latest snapshot
            {data.capturedAt
              ? ` · ${formatDistanceToNow(new Date(data.capturedAt), {
                  addSuffix: true,
                })}`
              : null}
          </CardDescription>
        </div>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full",
            "text-primary bg-primary/10",
          )}
        >
          <HardDrive className="size-4" />
        </span>
      </CardHeader>

      <CardContent
        className={`
          grid gap-4 p-5
          md:grid-cols-3
        `}
      >
        <Stat label="Bucket total" value={formatBytes(data.bucketTotalBytes)} />
        <Stat
          label="Tracked in DB"
          value={formatBytes(data.trackedBytes)}
          hint={
            data.bucketTotalBytes > 0
              ? `${Math.round(
                  (data.trackedBytes / data.bucketTotalBytes) * 100,
                )}% of bucket bytes`
              : undefined
          }
        />
        <Stat
          label="Unaccounted"
          value={formatBytes(data.unaccountedBytes)}
          hint={
            orphanShare > 0.05 ? "Likely orphaned objects" : "Within tolerance"
          }
          warn={orphanShare > 0.05}
        />
      </CardContent>

      <div className="border-border/60 border-t px-5 py-4">
        <div
          className={`
            text-muted-foreground mb-2 text-[10px] font-bold tracking-widest
            uppercase
          `}
        >
          By bucket
        </div>
        <ul
          className={`
            grid gap-2
            sm:grid-cols-2
          `}
        >
          {data.buckets
            .slice()
            .sort((a, b) => b.bytes - a.bytes)
            .map((b) => (
              <li
                key={b.bucket}
                className={`
                  bg-muted/40 flex items-center justify-between rounded-md px-3
                  py-2
                `}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{b.bucket}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {b.objectCount.toLocaleString()} objects
                  </span>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {formatBytes(b.bytes)}
                </span>
              </li>
            ))}
        </ul>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div>
      <div
        className={`
          text-muted-foreground text-[10px] font-bold tracking-widest uppercase
        `}
      >
        {label}
      </div>
      <div
        className={cn(
          "text-foreground text-xl font-semibold tracking-tight",
          warn && "text-warning flex items-center gap-1.5",
        )}
      >
        {warn ? <ShieldAlert className="size-4" /> : null}
        {value}
      </div>
      {hint ? (
        <div className="text-muted-foreground text-[11px]">{hint}</div>
      ) : null}
    </div>
  );
}
