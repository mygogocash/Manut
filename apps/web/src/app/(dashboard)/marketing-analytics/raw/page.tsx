"use client";

import {
  ArrowLeft,
  BarChart3,
  Database,
  Download,
  Layers,
  ListTree,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { exportRows } from "@/lib/crm-export";
import { useAuth } from "@/providers/auth-provider";
import {
  getMarketingDashboard,
  listMarketingMetrics,
  type MarketingDashboard,
  type MarketingMetric,
  METRIC_GROUP_LABELS,
  type MetricGroup,
} from "@/services/marketing-analytics.service";

const GROUP_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All categories" },
  { value: "core", label: "Core Metric" },
  { value: "transaction-type", label: "Transaction Type" },
  { value: "field", label: "Field" },
];

export default function MarketingRawExplorerPage() {
  const { hasAnyPermission } = useAuth();
  const canView = hasAnyPermission("marketing:raw:view");

  const [rows, setRows] = useState<MarketingMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [snap, setSnap] = useState<MarketingDashboard | null>(null);
  const debounced = useDebounce(search, 350);
  const pagination = usePagination();
  const { setTotalCount, setPage } = pagination;

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listMarketingMetrics({
        page: pagination.page,
        limit: pagination.pageSize,
        search: debounced || undefined,
        group: group !== "all" ? (group as MetricGroup) : undefined,
      });
      setRows(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, debounced, group, setTotalCount]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  // Catalog counts (moved here from the analytics landing when it became the
  // holistic overview) — a compact summary of what the API exposes.
  useEffect(() => {
    void getMarketingDashboard()
      .then((r) => setSnap(r.data))
      .catch(() => {});
  }, []);

  const countFor = (g: MetricGroup) =>
    snap?.byGroup.find((x) => x.group === g)?.count ?? 0;

  // Export the FULL filtered set (not just the current page) by fetching
  // everything that matches, then handing it to the shared exporter.
  const handleExport = useCallback(
    async (format: "csv" | "xlsx") => {
      try {
        setExporting(true);
        const res = await listMarketingMetrics({
          page: 1,
          limit: 500,
          search: debounced || undefined,
          group: group !== "all" ? (group as MetricGroup) : undefined,
        });
        exportRows<MarketingMetric>(
          "marketing-metrics",
          [
            { header: "Key", value: (r) => r.key },
            { header: "Label", value: (r) => r.label },
            { header: "Category", value: (r) => METRIC_GROUP_LABELS[r.group] },
            { header: "Description", value: (r) => r.description },
          ],
          res.data,
          format,
        );
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Export failed");
      } finally {
        setExporting(false);
      }
    },
    [debounced, group],
  );

  if (!canView) {
    return (
      <div className="px-6 py-6">
        <PageHeader title="Raw Data Explorer" />
        <p className="text-muted-foreground text-sm">
          You don&apos;t have access to the Raw Data Explorer.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Raw Data Explorer"
        subtitle="Every metric exposed by the BNII Analytics API"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/marketing-analytics">
            <ArrowLeft className="mr-1 size-3.5" />
            Marketing Analytics
          </Link>
        </Button>
      </PageHeader>

      {/* Catalog counts */}
      <div
        className={`
          mb-5 grid gap-4
          md:grid-cols-2
          lg:grid-cols-4
        `}
      >
        {!snap ? (
          Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[110px] rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              label="Total Metrics"
              value={snap.totalMetrics.toLocaleString()}
              change="From the live catalog"
              changeType="neutral"
              icon={Database}
              accent="primary"
            />
            <StatCard
              label="Core Metrics"
              value={countFor("core").toLocaleString()}
              change="Headline analytics"
              changeType="neutral"
              icon={BarChart3}
              accent="info"
            />
            <StatCard
              label="Transaction Types"
              value={countFor("transaction-type").toLocaleString()}
              change="Known event types"
              changeType="neutral"
              icon={Layers}
              accent="success"
            />
            <StatCard
              label="Fields"
              value={countFor("field").toLocaleString()}
              change="Per-transaction fields"
              changeType="neutral"
              icon={ListTree}
              accent="warning"
            />
          </>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search
            className={`
              text-muted-foreground absolute top-1/2 left-2.5 size-3.5
              -translate-y-1/2
            `}
          />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search metrics…"
            className="h-9 pl-8"
          />
        </div>
        <Select
          value={group}
          onValueChange={(v) => {
            setGroup(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {GROUP_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("csv")}
          disabled={exporting || rows.length === 0}
        >
          <Download className="mr-1 size-3.5" />
          CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("xlsx")}
          disabled={exporting || rows.length === 0}
        >
          <Download className="mr-1 size-3.5" />
          Excel
        </Button>
      </div>

      <DataTable
        loading={loading}
        data={rows}
        emptyMessage="No metrics match these filters"
        columns={[
          {
            key: "key",
            header: "Key",
            render: (r) => <span className="font-mono text-xs">{r.key}</span>,
          },
          { key: "label", header: "Label" },
          {
            key: "group",
            header: "Category",
            render: (r) => (
              <Badge variant="grey">{METRIC_GROUP_LABELS[r.group]}</Badge>
            ),
          },
          {
            key: "description",
            header: "Description",
            render: (r) => (
              <span className="text-muted-foreground">
                {r.description || "—"}
              </span>
            ),
          },
        ]}
        pagination={
          <DataPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        }
      />
    </div>
  );
}
