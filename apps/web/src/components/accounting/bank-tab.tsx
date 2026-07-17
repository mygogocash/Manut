"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ALL_FILTER,
  BANK_STATUSES,
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
  type BankTransaction,
  type BankTxSortField,
  listBankTransactions,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

interface BankTabProps {
  entities: Entity[];
}

export function BankTab({ entities }: BankTabProps) {
  const [bankTxns, setBankTxns] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER);
  const [sortBy, setSortBy] = useState<BankTxSortField | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const pagination = usePagination();

  const handleSortChange = useCallback(
    (key: string) => {
      setSortBy((prev) => {
        if (prev !== key) {
          setSortOrder("desc");
          return key as BankTxSortField;
        }
        if (sortOrder === "desc") {
          setSortOrder("asc");
          return key as BankTxSortField;
        }
        setSortOrder("desc");
        return undefined;
      });
    },
    [sortOrder],
  );

  const fetchBankTxns = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listBankTransactions({
        page: pagination.page,
        limit: pagination.pageSize,
        entityId: entityFilter === ALL_FILTER ? undefined : entityFilter,
        status: statusFilter === ALL_FILTER ? undefined : statusFilter,
        sortBy,
        sortOrder,
      });
      setBankTxns(result.data);
      pagination.setTotalCount(result.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load bank transactions";
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
    sortBy,
    sortOrder,
    pagination.setTotalCount,
  ]);

  useEffect(() => {
    void fetchBankTxns();
  }, [fetchBankTxns]);

  useEffect(() => {
    pagination.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityFilter, statusFilter, sortBy, sortOrder, pagination.setPage]);

  const columns = useMemo(
    () => [
      {
        key: "date",
        header: "Date",
        sortable: true,
        render: (t: BankTransaction) => (
          <span className="tabular-nums">{formatDate(t.date)}</span>
        ),
      },
      {
        key: "description",
        header: "Description",
        sortable: true,
        render: (t: BankTransaction) => (
          <span className="max-w-[250px] truncate">{t.description}</span>
        ),
      },
      {
        key: "entity",
        header: "Entity",
        sortable: true,
        render: (t: BankTransaction) => t.entity.name,
      },
      {
        key: "amount",
        header: "Amount",
        sortable: true,
        render: (t: BankTransaction) => (
          <span
            className={`
              tabular-nums
              ${Number(t.amount) < 0 ? "text-destructive" : ""}
            `}
          >
            {formatCurrency(t.amount)} {t.currency}
          </span>
        ),
        className: "text-right",
      },
      {
        key: "mappedAccount",
        header: "Mapped Account",
        // Mapped account is derived from a join; sort by it server-side
        // would need a separate orderBy. Leaving non-sortable for now.
        render: (t: BankTransaction) =>
          t.mapped ? `${t.mapped.code} - ${t.mapped.name}` : "—",
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        render: (t: BankTransaction) => (
          <Badge status={t.status}>{t.status}</Badge>
        ),
      },
    ],
    [],
  );

  const filtersDirty = useMemo(
    () => entityFilter !== ALL_FILTER || statusFilter !== ALL_FILTER,
    [entityFilter, statusFilter],
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

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 min-w-[120px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
            {BANK_STATUSES.map((s) => (
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
            }}
            className="text-xs"
          >
            Clear
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={bankTxns}
        loading={loading}
        emptyMessage="No bank transactions found"
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
