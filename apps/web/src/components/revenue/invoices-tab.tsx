"use client";

import { DollarSign, FileText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { KpiCard } from "@/components/revenue/revenue-kpi-card";
import {
  formatFullCurrency,
  INVOICE_COLORS,
} from "@/components/revenue/revenue-utils";
import { DataTable } from "@/components/shared/data-table";
import { ApiError } from "@/lib/api-client";
import {
  getRevenueInvoices,
  type InvoiceSummary,
  type RevenuePeriod,
} from "@/services/revenue.service";

interface InvoiceStatusRow {
  status: string;
  count: number;
  total: number;
}

const invoiceColumns = [
  {
    key: "status",
    header: "Status",
    render: (r: InvoiceStatusRow) => (
      <div className="flex items-center gap-2">
        <div
          className="size-2.5 rounded-full"
          style={{
            backgroundColor:
              INVOICE_COLORS[r.status] ?? "hsl(var(--muted-foreground))",
          }}
        />
        <span className="text-foreground font-medium capitalize">
          {r.status}
        </span>
      </div>
    ),
  },
  {
    key: "count",
    header: "Count",
    className: "text-right",
    render: (r: InvoiceStatusRow) => (
      <span className="text-foreground tabular-nums">{r.count}</span>
    ),
  },
  {
    key: "total",
    header: "Total Amount",
    className: "text-right",
    render: (r: InvoiceStatusRow) => (
      <span className="text-foreground tabular-nums">
        {formatFullCurrency(r.total)}
      </span>
    ),
  },
];

export function InvoicesTab({ period }: { period: RevenuePeriod }) {
  const [data, setData] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getRevenueInvoices({ period });
      setData(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load invoices",
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const rows: InvoiceStatusRow[] = data
    ? Object.entries(data.byStatus).map(([status, detail]) => ({
        status,
        count: detail.count,
        total: detail.total,
      }))
    : [];

  return (
    <div className="flex flex-col gap-4">
      {data && !loading && (
        <div
          className={`
            grid grid-cols-1 gap-4
            sm:grid-cols-2
          `}
        >
          <KpiCard
            icon={FileText}
            title="Grand Total Invoiced"
            value={formatFullCurrency(data.grandTotal)}
            subtitle={`${rows.reduce((s, r) => s + r.count, 0)} invoices`}
          />
          <KpiCard
            icon={DollarSign}
            title="Status Breakdown"
            value={`${rows.length} statuses`}
            subtitle={rows.map((r) => `${r.status}: ${r.count}`).join(", ")}
          />
        </div>
      )}
      <DataTable
        columns={invoiceColumns}
        data={rows}
        loading={loading}
        title="Invoices by Status"
        emptyMessage="No invoice data for this period"
      />
    </div>
  );
}
