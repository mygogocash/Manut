"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ALL_FILTER,
  BANK_STATUSES,
  formatCurrency,
  formatDate,
} from "@/components/accounting/accounting-utils";
import { SmartMatchPanel } from "@/components/accounting/smart-match-panel";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  getReconciliationSummary,
  listBankTransactions,
  reconcileBankTransaction,
  type ReconciliationSummary,
  unreconcileBankTransaction,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

interface BankTabProps {
  entities: Entity[];
  canReconcile?: boolean;
}

export function BankTab({ entities, canReconcile = false }: BankTabProps) {
  const [bankTxns, setBankTxns] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER);
  const [sortBy, setSortBy] = useState<BankTxSortField | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [statementBalance, setStatementBalance] = useState("");
  const pagination = usePagination();

  const scopedEntityId = entityFilter === ALL_FILTER ? undefined : entityFilter;

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
        entityId: scopedEntityId,
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
    scopedEntityId,
    statusFilter,
    sortBy,
    sortOrder,
    pagination.setTotalCount,
  ]);

  const loadSummary = useCallback(async () => {
    if (!scopedEntityId) {
      setSummary(null);
      return;
    }
    try {
      const res = await getReconciliationSummary({
        entityId: scopedEntityId,
        statementBalance:
          statementBalance.trim() === "" ? undefined : Number(statementBalance),
      });
      setSummary(res.data);
    } catch {
      setSummary(null);
    }
  }, [scopedEntityId, statementBalance]);

  useEffect(() => {
    void fetchBankTxns();
  }, [fetchBankTxns]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    pagination.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityFilter, statusFilter, sortBy, sortOrder, pagination.setPage]);

  const onToggleReconcile = useCallback(
    async (t: BankTransaction) => {
      const wasReconciled = t.reconciled ?? t.status === "reconciled";
      try {
        setReconcilingId(t.id);
        if (wasReconciled) {
          await unreconcileBankTransaction(t.id);
          toast.success("Transaction un-reconciled");
        } else {
          await reconcileBankTransaction(t.id);
          toast.success("Transaction reconciled");
        }
        await Promise.all([fetchBankTxns(), loadSummary()]);
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Failed to update transaction";
        toast.error(msg);
      } finally {
        setReconcilingId(null);
      }
    },
    [fetchBankTxns, loadSummary],
  );

  const columns = useMemo(() => {
    const base = [
      {
        key: "date",
        mobileRole: "field" as const,
        header: "Date",
        sortable: true,
        render: (t: BankTransaction) => (
          <span className="tabular-nums">{formatDate(t.date)}</span>
        ),
      },
      {
        key: "description",
        mobileRole: "title" as const,
        header: "Description",
        sortable: true,
        render: (t: BankTransaction) => (
          <span className="max-w-[250px] truncate">{t.description}</span>
        ),
      },
      {
        key: "entity",
        mobileRole: "detail" as const,
        header: "Entity",
        sortable: true,
        render: (t: BankTransaction) => t.entity.name,
      },
      {
        key: "amount",
        mobileRole: "field" as const,
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
        mobileRole: "detail" as const,
        header: "Mapped Account",
        render: (t: BankTransaction) =>
          t.mapped ? `${t.mapped.code} - ${t.mapped.name}` : "—",
      },
      {
        key: "status",
        mobileRole: "badge" as const,
        header: "Status",
        sortable: true,
        render: (t: BankTransaction) => (
          <Badge status={t.status}>{t.status}</Badge>
        ),
      },
    ];
    if (!canReconcile) return base;
    return [
      ...base,
      {
        key: "actions",
        mobileRole: "actions" as const,
        header: "",
        className: "text-right",
        render: (t: BankTransaction) => {
          const isReconciled = t.reconciled ?? t.status === "reconciled";
          return (
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={reconcilingId === t.id}
              onClick={() => onToggleReconcile(t)}
            >
              {isReconciled ? "Unreconcile" : "Reconcile"}
            </Button>
          );
        },
      },
    ];
  }, [canReconcile, reconcilingId, onToggleReconcile]);

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

      {canReconcile && scopedEntityId ? (
        <SmartMatchPanel
          entityId={scopedEntityId}
          onSettled={() => {
            void fetchBankTxns();
            void loadSummary();
          }}
        />
      ) : null}

      {summary ? (
        <div
          className={`
            border-border bg-surface flex flex-col gap-3 rounded-lg border p-3
            md:flex-row md:items-end md:justify-between
          `}
        >
          <div
            className={`
              grid flex-1 grid-cols-2 gap-x-6 gap-y-1 text-sm
              md:grid-cols-4
            `}
          >
            <Stat label="Reconciled" value={summary.reconciledCount} plain />
            <Stat label="Outstanding" value={summary.unreconciledCount} plain />
            <Stat label="Book balance" value={summary.bookBalance} />
            <Stat
              label="Difference"
              value={summary.difference}
              highlight={
                summary.difference !== null &&
                Math.abs(summary.difference) >= 0.01
              }
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">
                Statement closing balance
              </span>
              <Input
                type="number"
                inputMode="decimal"
                value={statementBalance}
                onChange={(e) => setStatementBalance(e.target.value)}
                placeholder="0.00"
                className="h-9 w-40 text-xs"
              />
            </div>
            {summary.statementBalance !== null ? (
              <Badge status={summary.balanced ? "posted" : "overdue"}>
                {summary.balanced ? "Balanced" : "Not balanced"}
              </Badge>
            ) : null}
          </div>
        </div>
      ) : null}

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

function Stat({
  label,
  value,
  plain = false,
  highlight = false,
}: {
  label: string;
  value: number | null;
  plain?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span
        className={`
          tabular-nums
          ${highlight ? "text-destructive font-medium" : ""}
        `}
      >
        {value === null ? "—" : plain ? value : formatCurrency(value)}
      </span>
    </div>
  );
}
