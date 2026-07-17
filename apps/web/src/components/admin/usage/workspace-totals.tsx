"use client";

import { Database, FileUp, HardDrive, Users } from "lucide-react";

import { formatBytes } from "@/components/admin/usage/format-bytes";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { WorkspaceUsageTotals } from "@/services/admin-usage.service";

interface Tile {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  color: string;
}

interface WorkspaceTotalsProps {
  totals: WorkspaceUsageTotals | null;
  loading?: boolean;
}

export function WorkspaceTotals({ totals, loading }: WorkspaceTotalsProps) {
  if (loading || !totals) {
    return (
      <div
        className={`
          grid grid-cols-2 gap-3
          md:grid-cols-4
        `}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-xl" />
        ))}
      </div>
    );
  }

  const tiles: Tile[] = [
    {
      label: "Active users",
      value: totals.activeUsers.toLocaleString(),
      hint: `${totals.totalUsers.toLocaleString()} total`,
      icon: <Users className="size-4" />,
      color: "text-info bg-info/10",
    },
    {
      label: "Storage used",
      value: formatBytes(totals.storageBytes),
      hint: "across HR, data room, general",
      icon: <HardDrive className="size-4" />,
      color: "text-primary bg-primary/10",
    },
    {
      label: "Files",
      value: totals.fileCount.toLocaleString(),
      hint: "tracked in Postgres",
      icon: <Database className="size-4" />,
      color: "text-success bg-success/10",
    },
    {
      label: "Added (30d)",
      value: totals.filesAdded30d.toLocaleString(),
      hint: "rolling 30 days",
      icon: <FileUp className="size-4" />,
      color: "text-warning bg-warning/10",
    },
  ];

  return (
    <div
      className={`
        grid grid-cols-2 gap-3
        md:grid-cols-4
      `}
    >
      {tiles.map((tile) => (
        <Card
          key={tile.label}
          className={`
            border-border/80 bg-card/80 gap-0 p-4 shadow-sm backdrop-blur-sm
          `}
        >
          <CardContent className="flex flex-col gap-2 p-0">
            <div className="flex items-center justify-between">
              <span
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                {tile.label}
              </span>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full",
                  tile.color,
                )}
              >
                {tile.icon}
              </span>
            </div>
            <div
              className={`text-foreground text-2xl font-semibold tracking-tight`}
            >
              {tile.value}
            </div>
            {tile.hint ? (
              <div className="text-muted-foreground text-[11px]">
                {tile.hint}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
