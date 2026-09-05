"use client";

import { Download, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ALL_FILTER,
  formatCurrency,
  formatDate,
} from "@/components/accounting/accounting-utils";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import {
  downloadWhtCertificate,
  listPayments,
  type Payment,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

interface PaymentsTabProps {
  entities: Entity[];
}

function paymentCurrency(payment: Payment): string {
  return payment.invoice?.currency ?? payment.currency ?? "";
}

export function PaymentsTab({ entities }: PaymentsTabProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState(ALL_FILTER);
  const pagination = usePagination();

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listPayments({
        page: pagination.page,
        limit: pagination.pageSize,
        entityId: entityFilter === ALL_FILTER ? undefined : entityFilter,
        type: "payable",
      });
      setPayments(result.data);
      pagination.setTotalCount(result.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load payments";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pagination.page,
    pagination.pageSize,
    entityFilter,
    pagination.setTotalCount,
  ]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    pagination.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityFilter, pagination.setPage]);

  const handleWht = useCallback(async (payment: Payment) => {
    try {
      setDownloadingId(payment.id);
      await downloadWhtCertificate(payment.id);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to download WHT certificate",
      );
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const columns = useMemo(
    () => [
      {
        key: "date",
        header: "Date",
        render: (p: Payment) => (
          <span className="tabular-nums">{formatDate(p.date)}</span>
        ),
      },
      {
        key: "bill",
        header: "Bill",
        render: (p: Payment) => (
          <span className="font-medium">{p.invoice?.invoiceNo ?? "—"}</span>
        ),
      },
      {
        key: "payee",
        header: "Vendor",
        render: (p: Payment) => p.invoice?.counterparty ?? "—",
      },
      {
        key: "amount",
        mobileRole: "field" as const,
        header: "Amount",
        className: "text-right",
        render: (p: Payment) => (
          <span className="tabular-nums">
            {formatCurrency(p.amount)} {paymentCurrency(p)}
          </span>
        ),
      },
      {
        key: "wht",
        header: "WHT",
        className: "text-right",
        render: (p: Payment) => (
          <span className="tabular-nums">{formatCurrency(p.whtAmount)}</span>
        ),
      },
      {
        key: "method",
        header: "Method",
        render: (p: Payment) => (
          <Badge status="sent">{p.method.replace("-", " ")}</Badge>
        ),
      },
      {
        key: "actions",
        mobileRole: "actions" as const,
        header: "",
        className: "w-12 text-right",
        render: (p: Payment) => {
          if (!(Number(p.whtAmount) > 0)) return null;
          return (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Download WHT certificate"
              disabled={downloadingId === p.id}
              onClick={() => void handleWht(p)}
            >
              {downloadingId === p.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
            </Button>
          );
        },
      },
    ],
    [downloadingId, handleWht],
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`
          border-border bg-surface flex flex-col gap-2 rounded-lg border p-3
          shadow-sm
          md:flex-row md:items-center
        `}
      >
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="h-10 min-w-[140px] text-xs">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All entities</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p
          className={`
            text-muted-foreground text-xs
            md:ml-2
          `}
        >
          AP disbursements against supplier bills. WHT certificates print from
          the row action.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={payments}
        loading={loading}
        emptyMessage="No supplier payments recorded"
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
