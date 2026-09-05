"use client";

import {
  Ban,
  Loader2,
  MoreHorizontal,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ALL_FILTER,
  formatCurrency,
  formatDate,
  INVOICE_STATUSES,
} from "@/components/accounting/accounting-utils";
import { ExpenseCreateDialog } from "@/components/accounting/expense-create-dialog";
import { PaymentDialog } from "@/components/accounting/payment-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  type ExpenseSummary,
  getExpenseSummary,
  type Invoice,
  listAccounts,
  listInvoices,
  updateInvoiceStatus,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

// Literal, full-class palette so Tailwind's static scan keeps these colours (a
// dynamic `bg-${x}` string would be purged — see the aging panel). Cycled by
// category index for the spend-breakdown bar.
const CATEGORY_COLORS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-orange-500",
] as const;

const WHOLE_YEAR = "__year__";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

// Payable-bill statuses that can still take a payment.
const PAYABLE_OPEN = ["sent", "partial", "overdue"];

interface ExpenseTabProps {
  entities: Entity[];
}

// A bill's single "category" account — the one distinct GL account across its
// lines. Mixed-account bills (shouldn't happen from the Expense create flow)
// resolve to null → shown as Uncategorized, matching the server roll-up.
function billCategoryId(bill: Invoice): string | null {
  const ids = [
    ...new Set(
      bill.lineItems
        .map((l) => l.glAccountId)
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  return ids.length === 1 ? ids[0]! : null;
}

export function ExpenseTab({ entities }: ExpenseTabProps) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("accounting:create");

  const now = useMemo(() => new Date(), []);
  const [entityId, setEntityId] = useState("");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<string>(String(now.getMonth() + 1));
  const [statusFilter, setStatusFilter] = useState<string>(ALL_FILTER);

  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [bills, setBills] = useState<Invoice[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [accountLabels, setAccountLabels] = useState<Map<string, string>>(
    new Map(),
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const pagination = usePagination();

  // Default to the first entity; the summary endpoint requires a concrete one.
  useEffect(() => {
    if (!entityId && entities[0]) setEntityId(entities[0].id);
  }, [entityId, entities]);

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y, y - 1, y - 2, y - 3];
  }, [now]);

  // Account id → "code — name" for the category column. One call per entity.
  useEffect(() => {
    if (!entityId) {
      setAccountLabels(new Map());
      return;
    }
    listAccounts({ entityId, type: "expense" })
      .then((res) =>
        setAccountLabels(
          new Map(res.data.map((a) => [a.id, `${a.code} — ${a.name}`])),
        ),
      )
      .catch(() => setAccountLabels(new Map()));
  }, [entityId]);

  const loadSummary = useCallback(async () => {
    if (!entityId) return;
    try {
      setSummaryLoading(true);
      const res = await getExpenseSummary({
        entityId,
        year,
        month: month === WHOLE_YEAR ? undefined : Number(month),
      });
      setSummary(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load expense summary",
      );
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [entityId, year, month]);

  const loadBills = useCallback(async () => {
    if (!entityId) return;
    try {
      setListLoading(true);
      const res = await listInvoices({
        page: pagination.page,
        limit: pagination.pageSize,
        entityId,
        type: "payable",
        status: statusFilter === ALL_FILTER ? undefined : statusFilter,
        sortBy: "issueDate",
        sortOrder: "desc",
      });
      // Status is filtered server-side, so the page rows and the total count
      // agree — never re-filter a loaded page (paginated-aggregate pitfall).
      setBills(res.data);
      pagination.setTotalCount(res.meta.total);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load bills",
      );
    } finally {
      setListLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entityId,
    statusFilter,
    pagination.page,
    pagination.pageSize,
    pagination.setTotalCount,
  ]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadBills();
  }, [loadBills]);

  useEffect(() => {
    pagination.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, statusFilter, pagination.setPage]);

  const refreshAll = useCallback(() => {
    void loadSummary();
    void loadBills();
  }, [loadSummary, loadBills]);

  const handleCancel = useCallback(
    async (bill: Invoice) => {
      const message = `Cancel bill "${bill.invoiceNo}"? This posts a reversing entry (the bill is not deleted).`;
      if (!window.confirm(message)) return;
      try {
        await updateInvoiceStatus(bill.id, "cancelled");
        toast.success("Bill cancelled (reversing entry posted)");
        refreshAll();
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Failed to cancel bill",
        );
      }
    },
    [refreshAll],
  );

  const categoryLabel = useCallback(
    (bill: Invoice): string => {
      const id = billCategoryId(bill);
      if (!id) return "Uncategorized";
      return accountLabels.get(id) ?? "—";
    },
    [accountLabels],
  );

  const columns = useMemo(
    () => [
      {
        key: "invoiceNo",
        mobileRole: "title" as const,
        header: "Bill No",
        render: (b: Invoice) => (
          <span className="font-medium">{b.invoiceNo}</span>
        ),
      },
      {
        key: "counterparty",
        mobileRole: "subtitle" as const,
        header: "Payee",
        render: (b: Invoice) => b.counterparty,
      },
      {
        key: "category",
        mobileRole: "detail" as const,
        header: "Category",
        render: (b: Invoice) => (
          <span className="text-muted-foreground text-xs">
            {categoryLabel(b)}
          </span>
        ),
      },
      {
        key: "amount",
        mobileRole: "field" as const,
        header: "Amount",
        className: "text-right",
        render: (b: Invoice) => (
          <span className="tabular-nums">
            {formatCurrency(b.amount)} {b.currency}
          </span>
        ),
      },
      {
        key: "issueDate",
        mobileRole: "detail" as const,
        header: "Bill Date",
        render: (b: Invoice) => (
          <span className="tabular-nums">{formatDate(b.issueDate)}</span>
        ),
      },
      {
        key: "dueDate",
        mobileRole: "field" as const,
        header: "Due Date",
        render: (b: Invoice) => (
          <span className="tabular-nums">{formatDate(b.dueDate)}</span>
        ),
      },
      {
        key: "status",
        mobileRole: "badge" as const,
        header: "Status",
        render: (b: Invoice) => <Badge status={b.status}>{b.status}</Badge>,
      },
      {
        key: "actions",
        mobileRole: "actions" as const,
        header: "",
        className: "w-12 text-right",
        render: (b: Invoice) => {
          const canPay = PAYABLE_OPEN.includes(b.status);
          // Void is blocked once a payment exists; only offer cancel while
          // nothing has been paid.
          const canCancel =
            ["sent", "overdue"].includes(b.status) &&
            Number(b.amountPaid) === 0;
          if (!canCreate || (!canPay && !canCancel)) return null;
          return (
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canPay && (
                    <DropdownMenuItem onClick={() => setPaying(b)}>
                      <Wallet className="mr-2 size-3.5" />
                      Pay bill
                    </DropdownMenuItem>
                  )}
                  {canCancel && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => void handleCancel(b)}
                    >
                      <Ban className="mr-2 size-3.5" />
                      Cancel bill
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [canCreate, categoryLabel, handleCancel],
  );

  const ccy = "THB";

  return (
    <div className="flex flex-col gap-4">
      {/* Filter + action bar */}
      <div
        className={`
          border-border bg-surface flex flex-col gap-2 rounded-lg border p-3
          shadow-sm
          md:flex-row md:items-center
        `}
      >
        <Select value={entityId} onValueChange={setEntityId}>
          <SelectTrigger className="h-10 min-w-[150px] text-xs">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            {entities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="h-10 min-w-[90px] text-xs">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="h-10 min-w-[130px] text-xs">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={WHOLE_YEAR}>Whole year</SelectItem>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>
                {m}
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

        {canCreate && (
          <Button
            onClick={() => setCreateOpen(true)}
            className="md:ml-auto"
            disabled={!entityId}
          >
            <Plus className="size-3.5" />
            New expense
          </Button>
        )}
      </div>

      {/* Spend summary — total + by-category breakdown for the period */}
      <ExpenseSummaryCard
        summary={summary}
        loading={summaryLoading}
        ccy={ccy}
        periodLabel={
          month === WHOLE_YEAR
            ? `${year}`
            : `${MONTHS[Number(month) - 1]} ${year}`
        }
      />

      {/* Bills list */}
      <DataTable
        columns={columns}
        data={bills}
        loading={listLoading}
        emptyMessage="No bills for this period"
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

      <ExpenseCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        entities={entities}
        defaultEntityId={entityId}
        onSaved={refreshAll}
      />

      <PaymentDialog
        open={!!paying}
        onOpenChange={(o) => !o && setPaying(null)}
        invoice={paying}
        onSaved={() => {
          setPaying(null);
          refreshAll();
        }}
      />
    </div>
  );
}

function ExpenseSummaryCard({
  summary,
  loading,
  ccy,
  periodLabel,
}: {
  summary: ExpenseSummary | null;
  loading: boolean;
  ccy: string;
  periodLabel: string;
}) {
  const total = summary?.total ?? 0;
  const categories = summary?.byCategory ?? [];

  return (
    <section className="border-border bg-card overflow-hidden rounded-xl border">
      <div
        className={`
          border-border flex items-center justify-between border-b px-5 py-4
        `}
      >
        <div className="flex items-center gap-2">
          <Receipt className="text-primary size-4" />
          <div>
            <p
              className={`
                text-muted-foreground text-[10px] font-semibold tracking-wider
                uppercase
              `}
            >
              Expense spend · {periodLabel}
            </p>
            <p className="font-serif text-xl font-medium tabular-nums">
              {ccy} {formatCurrency(total)}
            </p>
          </div>
        </div>
        {loading ? (
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        ) : null}
      </div>

      {categories.length === 0 ? (
        <div
          className={`
            text-muted-foreground flex h-24 items-center justify-center text-xs
          `}
        >
          {loading ? "Loading…" : "No expenses recorded for this period."}
        </div>
      ) : (
        <div className="space-y-4 p-5">
          <div className="bg-muted flex h-3 overflow-hidden rounded-full">
            {categories.map((c, i) =>
              c.total > 0 && total > 0 ? (
                <div
                  key={c.accountId ?? `uncat-${i}`}
                  className={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                  style={{ width: `${(c.total / total) * 100}%` }}
                  title={`${c.label}: ${ccy} ${formatCurrency(c.total)}`}
                />
              ) : null,
            )}
          </div>
          <div
            className={`
              grid grid-cols-1 gap-x-6 gap-y-1.5
              sm:grid-cols-2
            `}
          >
            {categories.map((c, i) => (
              <div
                key={c.accountId ?? `uncat-${i}`}
                className="flex items-center gap-2"
              >
                <span
                  className={`
                    size-2 shrink-0 rounded-full
                    ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                  `}
                />
                <span className="truncate text-xs">{c.label}</span>
                <span
                  className={`
                    text-muted-foreground ml-auto text-xs tabular-nums
                  `}
                >
                  {ccy} {formatCurrency(c.total)}
                  <span className="ml-1 text-[10px]">
                    ({total > 0 ? Math.round((c.total / total) * 100) : 0}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
