"use client";

import { ArrowLeft, Download, Search, Table2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  flagFor,
  formatMetricValue,
} from "@/app/(dashboard)/marketing-analytics/partners/partner-ui";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import { exportRows } from "@/lib/crm-export";
import { useAuth } from "@/providers/auth-provider";
import {
  getPartnerMetrics,
  type MarketingPartnerMetric,
  type MarketingPartnerMetrics,
} from "@/services/marketing-analytics.service";

/**
 * Per-partner Metrics — the canonical Atlas catalog evaluated against this
 * partner's daily series, grouped by category.
 *
 * "Live" is not a catalog property: a metric is live only when its formula
 * resolves against this partner's data, so both the per-category counts and
 * the headline differ per partner. No-data rows are hidden by default, which
 * is why a category can show 7 of 8 — the missing one has a null denominator,
 * not a missing definition. Toggle them back on to audit the whole catalog.
 *
 * Categories render as separate tables because the shared DataTable has no
 * group-header affordance; its `title` bar serves as the section heading.
 */
export default function PartnerMetricsPage() {
  const params = useParams<{ partnerId: string }>();
  const partnerId =
    typeof params?.partnerId === "string" ? params.partnerId : "";
  const { hasAnyPermission } = useAuth();
  const canView = hasAnyPermission("marketing:raw:view");

  const [data, setData] = useState<MarketingPartnerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState("");
  const [showNoData, setShowNoData] = useState(false);

  useEffect(() => {
    if (!partnerId) return;
    let cancelled = false;
    setLoading(true);
    void getPartnerMetrics({ partnerId })
      .then((r) => {
        if (cancelled) return;
        setData(r.data);
        setError(r.meta?.error ?? null);
        setNotFound(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        setNotFound(err instanceof ApiError && err.status === 400);
        setError(err instanceof ApiError ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [partnerId]);

  // Memoised so the export callback below keeps a stable identity.
  const visible = useMemo(
    () =>
      (data?.metrics ?? []).filter((m) => {
        if (!showNoData && m.status === "no-data") return false;
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          m.id.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.formula.toLowerCase().includes(q)
        );
      }),
    [data, search, showNoData],
  );

  const handleExport = useCallback(
    (format: "csv" | "xlsx") => {
      if (!data) return;
      exportRows<MarketingPartnerMetric>(
        `metrics-${data.partner.name.toLowerCase().replace(/\s+/g, "-")}`,
        [
          { header: "Metric ID", value: (m) => m.id },
          { header: "Category", value: (m) => m.category },
          { header: "Name", value: (m) => m.name },
          { header: "Description", value: (m) => m.meaning },
          { header: "Value", value: (m) => m.value ?? "" },
          { header: "Unit", value: (m) => m.unit },
          { header: "Formula", value: (m) => m.formula },
          { header: "Healthy", value: (m) => m.healthy },
          { header: "Warning", value: (m) => m.warning },
          { header: "Critical", value: (m) => m.critical },
          { header: "Status", value: (m) => m.status },
        ],
        visible,
        format,
      );
    },
    [data, visible],
  );

  if (!canView) {
    return (
      <div className="px-6 py-6">
        <PageHeader title="Metrics" />
        <p className="text-muted-foreground text-sm">
          You don&apos;t have access to Marketing Analytics.
        </p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="px-6 py-6">
        <PageHeader title="Metrics" />
        <p className="text-muted-foreground mb-4 text-sm">
          That telco partner isn&apos;t configured.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/marketing-analytics/partners">
            <ArrowLeft className="mr-1 size-3.5" />
            All partners
          </Link>
        </Button>
      </div>
    );
  }

  const name = data?.partner.name ?? "Partner";
  const flag = flagFor(data?.partner.country);

  return (
    <div className="px-6 py-6">
      <PageHeader title={`${flag ? `${flag} ` : ""}${name} · Metrics`}>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/marketing-analytics/partners/${partnerId}/raw`}>
            <Table2 className="mr-1 size-3.5" />
            Raw Data
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/marketing-analytics/partners">
            <ArrowLeft className="mr-1 size-3.5" />
            All partners
          </Link>
        </Button>
      </PageHeader>

      <p
        className={`
          text-muted-foreground mb-1 text-[11px] tracking-wider uppercase
        `}
      >
        {name} · canonical catalog {data?.catalogVersion ?? "v3.1"} ·{" "}
        {data?.totalCount ?? 0} metrics · {data?.liveCount ?? 0} computed live
      </p>
      <p className="text-muted-foreground mb-5 text-sm">
        {data
          ? `${data.categories.length} categories, evaluated against ${name}'s live BNII daily series.`
          : "Loading catalog…"}
      </p>

      {error ? (
        <div
          className={`
            mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2
            text-sm text-amber-800
          `}
        >
          Live feed unavailable — the catalog is listed with no values.{" "}
          <span className="opacity-80">{error}</span>
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search
            className={`
              text-muted-foreground absolute top-1/2 left-2.5 size-3.5
              -translate-y-1/2
            `}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search metrics…"
            className="h-9 pl-8"
          />
        </div>
        {/* Radix renders a button, so associate by id rather than wrapping. */}
        <div className="flex items-center gap-2 text-sm">
          <Switch
            id="show-no-data"
            checked={showNoData}
            onCheckedChange={setShowNoData}
          />
          <label htmlFor="show-no-data">Show no-data metrics</label>
        </div>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("csv")}
          disabled={visible.length === 0}
        >
          <Download className="mr-1 size-3.5" />
          CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("xlsx")}
          disabled={visible.length === 0}
        >
          <Download className="mr-1 size-3.5" />
          Excel
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[220px] rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No metrics match these filters.
        </p>
      ) : (
        <div className="space-y-6">
          {(data?.categories ?? []).map((c) => {
            const rows = visible.filter((m) => m.category === c.id);
            if (rows.length === 0) return null;
            return (
              <section key={c.id}>
                <DataTable
                  data={rows}
                  title={`${c.name} · ${c.total} metrics · ${c.live} live`}
                  emptyMessage="No metrics in this category"
                  columns={[
                    {
                      key: "id",
                      header: "Metric ID",
                      className: "w-[90px]",
                      render: (m) => (
                        <span className="font-mono text-xs">{m.id}</span>
                      ),
                    },
                    {
                      key: "name",
                      header: "Label · Description",
                      render: (m) => (
                        <div>
                          <div className="font-medium">{m.name}</div>
                          <div className="text-muted-foreground text-xs">
                            {m.meaning || "—"}
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: "value",
                      header: "Value",
                      className: "text-right",
                      render: (m) => (
                        <span
                          className="font-medium tabular-nums"
                          title={
                            m.healthy
                              ? `Healthy: ${m.healthy} · Warning: ${m.warning} · Critical: ${m.critical}`
                              : undefined
                          }
                        >
                          {formatMetricValue(m.value, m.unit)}
                        </span>
                      ),
                    },
                    {
                      key: "formula",
                      header: "Formula",
                      render: (m) => (
                        <span
                          className={`
                            text-muted-foreground font-mono text-[11px]
                          `}
                        >
                          {m.formula}
                        </span>
                      ),
                    },
                    {
                      key: "status",
                      header: "Status",
                      className: "w-[110px]",
                      render: (m) =>
                        m.status === "live" ? (
                          <span
                            className={`
                              inline-flex items-center rounded-md bg-emerald-50
                              px-2 py-0.5 font-mono text-[11px] text-emerald-700
                              ring-1 ring-emerald-200 ring-inset
                            `}
                          >
                            LIVE
                          </span>
                        ) : (
                          <span
                            className={`
                              text-muted-foreground inline-flex items-center
                              rounded-md px-2 py-0.5 font-mono text-[11px]
                              ring-1 ring-inset
                            `}
                          >
                            no data
                          </span>
                        ),
                    },
                  ]}
                />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
