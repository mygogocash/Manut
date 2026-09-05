"use client";

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
  downloadTaxInvoice,
  listPayments,
  type Payment,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

interface ReceiptsTabProps {
  entities: Entity[];
}

function paymentCurrency(payment: Payment): string {
  return payment.invoice?.currency ?? payment.currency ?? "";
}

export function ReceiptsTab({ entities }: ReceiptsTabProps) {
  const [receipts, setReceipts] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState(ALL_FILTER);
  const pagination = usePagination();

  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listPayments({
        page: pagination.page,
        limit: pagination.pageSize,
        entityId: entityFilter === ALL_FILTER ? undefined : entityFilter,
        type: "receivable",
      });
      setReceipts(result.data);
      pagination.setTotalCount(result.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load receipts";
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
    void fetchReceipts();
  }, [fetchReceipts]);

  useEffect(() => {
    pagination.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityFilter, pagination.setPage]);

  const columns = useMemo(
    () => [
      {
        key: "receiptNo",
        header: "Receipt No",
        render: (p: Payment) => (
          <span className="font-medium">{p.receiptNo || "—"}</span>
        ),
      },
      {
        key: "invoice",
        header: "Invoice",
        render: (p: Payment) => p.invoice?.invoiceNo ?? "—",
      },
      {
        key: "counterparty",
        header: "Customer",
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
        key: "date",
        header: "Date",
        render: (p: Payment) => (
          <span className="tabular-nums">{formatDate(p.date)}</span>
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
        key: "taxInvoice",
        header: "",
        render: (p: Payment) =>
          p.receiptNo ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => {
                void downloadTaxInvoice(p.id).catch((err: unknown) =>
                  toast.error(
                    err instanceof ApiError
                      ? err.message
                      : "Failed to download tax invoice",
                  ),
                );
              }}
            >
              Tax invoice
            </Button>
          ) : null,
      },
    ],
    [],
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
          AR receipts against customer invoices. Numbers follow RCPYYYYMM###.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={receipts}
        loading={loading}
        emptyMessage="No receipts recorded"
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
