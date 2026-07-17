"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ALL_FILTER,
  formatCurrency,
  formatDate,
  INVOICE_STATUSES,
  INVOICE_TYPES,
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
  type Invoice,
  type InvoiceSortField,
  listInvoices,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

interface InvoicesTabProps {
  entities: Entity[];
}

export function InvoicesTab({ entities }: InvoicesTabProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER);
  const [typeFilter, setTypeFilter] = useState(ALL_FILTER);
  const [sortBy, setSortBy] = useState<InvoiceSortField | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const pagination = usePagination();

  const handleSortChange = useCallback(
    (key: string) => {
      setSortBy((prev) => {
        if (prev !== key) {
          setSortOrder("desc");
          return key as InvoiceSortField;
        }
        if (sortOrder === "desc") {
          setSortOrder("asc");
          return key as InvoiceSortField;
        }
        setSortOrder("desc");
        return undefined;
      });
    },
    [sortOrder],
  );

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listInvoices({
        page: pagination.page,
        limit: pagination.pageSize,
        entityId: entityFilter === ALL_FILTER ? undefined : entityFilter,
        status: statusFilter === ALL_FILTER ? undefined : statusFilter,
        type: typeFilter === ALL_FILTER ? undefined : typeFilter,
        sortBy,
        sortOrder,
      });
      setInvoices(result.data);
      pagination.setTotalCount(result.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load invoices";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pagination.page,
    pagination.pageSize,
    entityFilter,
    statusFilter,
    typeFilter,
    sortBy,
    sortOrder,
    pagination.setTotalCount,
  ]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    pagination.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entityFilter,
    statusFilter,
    typeFilter,
    sortBy,
    sortOrder,
    pagination.setPage,
  ]);

  const columns = useMemo(
    () => [
      {
        key: "invoiceNo",
        header: "Invoice No",
        sortable: true,
        render: (i: Invoice) => (
          <span className="font-medium">{i.invoiceNo}</span>
        ),
      },
      {
        key: "type",
        header: "Type",
        sortable: true,
        render: (i: Invoice) => (
          <Badge variant={i.type === "receivable" ? "blue" : "amber"}>
            {i.type}
          </Badge>
        ),
      },
      {
        key: "counterparty",
        header: "Counterparty",
        sortable: true,
        render: (i: Invoice) => i.counterparty,
      },
      {
        key: "amount",
        header: "Amount",
        sortable: true,
        render: (i: Invoice) => (
          <span className="tabular-nums">
            {formatCurrency(i.amount)} {i.currency}
          </span>
        ),
        className: "text-right",
      },
      {
        key: "issueDate",
        header: "Issue Date",
        sortable: true,
        render: (i: Invoice) => (
          <span className="tabular-nums">{formatDate(i.issueDate)}</span>
        ),
      },
      {
        key: "dueDate",
        header: "Due Date",
        sortable: true,
        render: (i: Invoice) => (
          <span className="tabular-nums">{formatDate(i.dueDate)}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        render: (i: Invoice) => <Badge status={i.status}>{i.status}</Badge>,
      },
    ],
    [],
  );

  const filtersDirty = useMemo(
    () =>
      entityFilter !== ALL_FILTER ||
      statusFilter !== ALL_FILTER ||
      typeFilter !== ALL_FILTER,
    [entityFilter, statusFilter, typeFilter],
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

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-10 min-w-[120px] text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All types</SelectItem>
            {INVOICE_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 min-w-[120px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
            {INVOICE_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtersDirty && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              setEntityFilter(ALL_FILTER);
              setStatusFilter(ALL_FILTER);
              setTypeFilter(ALL_FILTER);
            }}
            className="text-xs"
          >
            Clear
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        loading={loading}
        emptyMessage="No invoices found"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
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
