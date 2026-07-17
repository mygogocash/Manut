"use client";

import { formatDistanceToNow } from "date-fns";

import { formatBytes } from "@/components/admin/usage/format-bytes";
import { Avatar } from "@/components/shared/avatar";
import { DataTable } from "@/components/shared/data-table";
import { cn } from "@/lib/utils";
import type { PerUserStorage } from "@/services/admin-usage.service";

interface StorageTableProps {
  rows: PerUserStorage[];
  loading?: boolean;
  pagination?: React.ReactNode;
  actions?: React.ReactNode;
}

const SEGMENT_COLORS = {
  general: "bg-info",
  hr: "bg-primary",
  dataroom: "bg-success",
} as const;

function StorageBreakdownBar({ row }: { row: PerUserStorage }) {
  const total = row.totalBytes || 1;
  const segments: Array<{
    key: keyof typeof SEGMENT_COLORS;
    bytes: number;
    label: string;
  }> = [
    { key: "general", bytes: row.breakdown.generalBytes, label: "General" },
    { key: "hr", bytes: row.breakdown.hrBytes, label: "HR" },
    { key: "dataroom", bytes: row.breakdown.dataroomBytes, label: "Data Room" },
  ];

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`bg-muted flex h-1.5 w-full overflow-hidden rounded-full`}
        role="img"
        aria-label="Storage breakdown by category"
      >
        {segments.map((seg) =>
          seg.bytes > 0 ? (
            <span
              key={seg.key}
              className={cn("h-full", SEGMENT_COLORS[seg.key])}
              style={{ width: `${(seg.bytes / total) * 100}%` }}
              title={`${seg.label}: ${formatBytes(seg.bytes)}`}
            />
          ) : null,
        )}
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-x-3 text-[10px]">
        {segments
          .filter((s) => s.bytes > 0)
          .map((s) => (
            <span key={s.key} className="flex items-center gap-1">
              <span
                className={cn(
                  "inline-block size-2 rounded-full",
                  SEGMENT_COLORS[s.key],
                )}
              />
              {s.label} {formatBytes(s.bytes)}
            </span>
          ))}
      </div>
    </div>
  );
}

export function StorageTable({
  rows,
  loading,
  pagination,
  actions,
}: StorageTableProps) {
  return (
    <DataTable
      title="Storage by user"
      actions={actions}
      loading={loading}
      data={rows}
      pagination={pagination}
      emptyMessage="No upload activity yet"
      columns={[
        {
          key: "user",
          header: "User",
          render: (row) => (
            <div className="flex items-center gap-3">
              <Avatar name={row.name} size="sm" />
              <div className="min-w-0">
                <div className="text-foreground truncate text-sm font-medium">
                  {row.name}
                </div>
                <div className="text-muted-foreground truncate text-xs">
                  {row.email}
                </div>
              </div>
            </div>
          ),
        },
        {
          key: "total",
          header: "Total",
          className: "tabular-nums",
          render: (row) => (
            <div className="text-foreground text-sm font-semibold">
              {formatBytes(row.totalBytes)}
            </div>
          ),
        },
        {
          key: "files",
          header: "Files",
          className: "tabular-nums",
          render: (row) => (
            <div className="text-foreground text-sm">
              {row.fileCount.toLocaleString()}
            </div>
          ),
        },
        {
          key: "breakdown",
          header: "Breakdown",
          className: "min-w-[220px]",
          render: (row) => <StorageBreakdownBar row={row} />,
        },
        {
          key: "lastUpload",
          header: "Last upload",
          render: (row) =>
            row.lastUploadAt ? (
              <span
                className="text-muted-foreground text-xs"
                title={new Date(row.lastUploadAt).toLocaleString()}
              >
                {formatDistanceToNow(new Date(row.lastUploadAt), {
                  addSuffix: true,
                })}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            ),
        },
      ]}
    />
  );
}
