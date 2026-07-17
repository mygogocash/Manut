"use client";

import { Search } from "lucide-react";

import { ActivityTable } from "@/components/admin/usage/activity-table";
import { BucketHealthCard } from "@/components/admin/usage/bucket-health-card";
import { StorageTable } from "@/components/admin/usage/storage-table";
import { WorkspaceTotals } from "@/components/admin/usage/workspace-totals";
import { Tabs } from "@/components/shared/tabs";
import { Input } from "@/components/ui/input";
import type {
  ActivitySource,
  BucketHealth,
  PerUserActivity,
  PerUserStorage,
  WorkspaceUsageTotals,
} from "@/services/admin-usage.service";

export type UsageView = "storage" | "activity";

interface AdminUsageTabProps {
  totals: WorkspaceUsageTotals | null;
  loadingTotals: boolean;
  view: UsageView;
  onViewChange: (next: UsageView) => void;

  storageRows: PerUserStorage[];
  loadingStorage: boolean;
  storageSearch: string;
  onStorageSearchChange: (next: string) => void;
  storagePagination: React.ReactNode;

  activityRows: PerUserActivity[];
  activitySource: ActivitySource;
  loadingActivity: boolean;
  activitySearch: string;
  onActivitySearchChange: (next: string) => void;
  activityPagination: React.ReactNode;

  bucketHealth: BucketHealth | null;
  loadingBuckets: boolean;
}

const VIEW_TABS = [
  { id: "storage", label: "Storage" },
  { id: "activity", label: "Activity" },
] as const;

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full max-w-xs">
      <Search
        className={`
          text-muted-foreground pointer-events-none absolute top-1/2 left-2.5
          size-4 -translate-y-1/2
        `}
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
      />
    </div>
  );
}

export function AdminUsageTab({
  totals,
  loadingTotals,
  view,
  onViewChange,
  storageRows,
  loadingStorage,
  storageSearch,
  onStorageSearchChange,
  storagePagination,
  activityRows,
  activitySource,
  loadingActivity,
  activitySearch,
  onActivitySearchChange,
  activityPagination,
  bucketHealth,
  loadingBuckets,
}: AdminUsageTabProps) {
  return (
    <div className="flex w-full flex-col gap-8">
      <section aria-label="Workspace usage totals">
        <WorkspaceTotals totals={totals} loading={loadingTotals} />
      </section>

      <Tabs
        tabs={VIEW_TABS.map((t) => ({ id: t.id, label: t.label }))}
        active={view}
        onChange={(id) => onViewChange(id as UsageView)}
        className="w-full"
      />

      {view === "storage" ? (
        <>
          <section className="space-y-3" aria-label="Storage by user">
            <StorageTable
              rows={storageRows}
              loading={loadingStorage}
              pagination={storagePagination}
              actions={
                <SearchInput
                  value={storageSearch}
                  onChange={onStorageSearchChange}
                  placeholder="Search name or email"
                />
              }
            />
          </section>
          <section aria-label="Bucket health">
            <BucketHealthCard data={bucketHealth} loading={loadingBuckets} />
          </section>
        </>
      ) : (
        <section className="space-y-3" aria-label="Activity by user">
          <ActivityTable
            rows={activityRows}
            source={activitySource}
            loading={loadingActivity}
            pagination={activityPagination}
            actions={
              <SearchInput
                value={activitySearch}
                onChange={onActivitySearchChange}
                placeholder="Search name or email"
              />
            }
          />
        </section>
      )}
    </div>
  );
}
