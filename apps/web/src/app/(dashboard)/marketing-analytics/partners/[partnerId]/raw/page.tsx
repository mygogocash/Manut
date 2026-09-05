"use client";

import { ArrowLeft, Download, Search, Sigma } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  flagFor,
  formatFieldValue,
  SOURCE_BADGE,
  SOURCE_FILTERS,
} from "@/app/(dashboard)/marketing-analytics/partners/partner-ui";
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
import { ApiError } from "@/lib/api-client";
import { exportRows } from "@/lib/crm-export";
import { useAuth } from "@/providers/auth-provider";
import {
  getMarketingRawFields,
  type MarketingRawField,
  type MarketingRawFields,
  RAW_AGGREGATION_LABELS,
} from "@/services/marketing-analytics.service";

/**
 * Per-partner Raw Data — the 31 Atlas fields with their window headline,
 * upstream source and live/no-data status.
 *
 * The field list is fetched whole (a fixed 31 rows), so filtering it in the
 * client never reduces a partial page.
 */
export default function PartnerRawDataPage() {
  const params = useParams<{ partnerId: string }>();
  const partnerId =
    typeof params?.partnerId === "string" ? params.partnerId : "";
  const { hasAnyPermission } = useAuth();
  const canView = hasAnyPermission("marketing:raw:view");

  const [raw, setRaw] = useState<MarketingRawFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");

  useEffect(() => {
    if (!partnerId) return;
    let cancelled = false;
    setLoading(true);
    void getMarketingRawFields({ partnerId, days: 30 })
      .then((r) => {
        if (cancelled) return;
        setRaw(r.data);
        setError(r.meta?.error ?? null);
        setNotFound(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setRaw(null);
        // An unrecognised partner id is a 400 from the service, not a blank page.
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
  const rows = useMemo(
    () =>
      (raw?.fields ?? []).filter((f) => {
        if (source !== "all" && f.source !== source) return false;
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          f.fieldId.toLowerCase().includes(q) ||
          f.label.toLowerCase().includes(q)
        );
      }),
    [raw, search, source],
  );

  const handleExport = useCallback(
    (format: "csv" | "xlsx") => {
      if (!raw) return;
      exportRows<MarketingRawField>(
        `raw-data-${raw.partner.name.toLowerCase().replace(/\s+/g, "-")}`,
        [
          { header: "Field ID", value: (r) => r.fieldId },
          { header: "Label", value: (r) => r.label },
          { header: "Source", value: (r) => r.sourceLabel },
          { header: `Value (${raw.days}d)`, value: (r) => r.value ?? "" },
          { header: "Aggregation", value: (r) => r.agg },
          { header: "Days reported", value: (r) => r.days },
          { header: "Status", value: (r) => r.status },
        ],
        rows,
        format,
      );
    },
    [raw, rows],
  );

  if (!canView) {
    return (
      <div className="px-6 py-6">
        <PageHeader title="Raw Data" />
        <p className="text-muted-foreground text-sm">
          You don&apos;t have access to the Raw Data explorer.
        </p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="px-6 py-6">
        <PageHeader title="Raw Data" />
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

  const name = raw?.partner.name ?? "Partner";
  const flag = flagFor(raw?.partner.country);

  return (
    <div className="px-6 py-6">
      <PageHeader title={`${flag ? `${flag} ` : ""}${name} · Raw Data`}>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/marketing-analytics/partners/${partnerId}/metrics`}>
            <Sigma className="mr-1 size-3.5" />
            Metrics
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
        {name} · {raw?.totalCount ?? 31} raw fields · {raw?.days ?? 30}-day
        totals
      </p>
      <p className="text-muted-foreground mb-5 text-sm">
        {raw
          ? `${raw.liveCount} of ${raw.totalCount} data fields sourced live from the BNII Analytics API.`
          : "Loading field breakdown…"}
      </p>

      {error ? (
        <div
          className={`
            mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2
            text-sm text-amber-800
          `}
        >
          Live feed unavailable — showing the field list with no values.{" "}
          <span className="opacity-80">{error}</span>
        </div>
      ) : null}

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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields…"
            className="h-9 pl-8"
          />
        </div>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="h-9 w-[190px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_FILTERS.map((o) => (
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
          disabled={rows.length === 0}
        >
          <Download className="mr-1 size-3.5" />
          CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("xlsx")}
          disabled={rows.length === 0}
        >
          <Download className="mr-1 size-3.5" />
          Excel
        </Button>
      </div>

      <DataTable
        loading={loading}
        data={rows}
        emptyMessage="No fields match these filters"
        skeletonRows={12}
        columns={[
          {
            key: "fieldId",
            header: "Field ID",
            render: (r) => (
              <span className="font-mono text-xs">{r.fieldId}</span>
            ),
          },
          { key: "label", header: "Label" },
          {
            key: "source",
            header: "Source",
            render: (r) => (
              <span
                className={`
                  inline-flex items-center rounded-md px-2 py-0.5 font-mono
                  text-[11px] ring-1 ring-inset
                  ${SOURCE_BADGE[r.source]}
                `}
              >
                {r.sourceLabel}
              </span>
            ),
          },
          {
            key: "value",
            header: `Value (${raw?.days ?? 30}d)`,
            render: (r) => (
              <span
                className="font-medium tabular-nums"
                title={RAW_AGGREGATION_LABELS[r.agg]}
              >
                {formatFieldValue(r.value)}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (r) =>
              r.status === "live" ? (
                <span
                  className={`
                    inline-flex items-center gap-1.5 font-mono text-[11px]
                    text-emerald-700
                  `}
                >
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  BNII live
                  {r.note ? ` · ${r.note}` : ""}
                </span>
              ) : (
                <span
                  className={`
                    text-muted-foreground inline-flex items-center gap-1.5
                    font-mono text-[11px]
                  `}
                >
                  <span
                    className={`bg-muted-foreground/40 size-1.5 rounded-full`}
                  />
                  no BNII source
                </span>
              ),
          },
        ]}
      />
    </div>
  );
}
