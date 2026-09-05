"use client";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock3,
  FileWarning,
  Landmark,
  Loader2,
  RefreshCw,
  Scale,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ALL_FILTER,
  formatDate,
} from "@/components/accounting/accounting-utils";
import { JournalReviewSheet } from "@/components/accounting/journal-review-sheet";
import { Badge } from "@/components/shared/badge";
import { FormDatePicker } from "@/components/shared/form-date-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  bulkApproveJournals,
  bulkRejectJournals,
  type CorporateFinanceOverview,
  getCorporateFinanceOverview,
  type JournalEntryDetail,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

type Period = "mtd" | "qtd" | "ytd" | "custom";

interface CorporateFinanceOverviewProps {
  entities: Entity[];
  canApprove: boolean;
  canPost: boolean;
  onNavigate: (tab: string) => void;
  onDataChanged: () => void;
}

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "mtd", label: "MTD" },
  { id: "qtd", label: "QTD" },
  { id: "ytd", label: "YTD" },
  { id: "custom", label: "Custom" },
];

export function CorporateFinanceOverview({
  entities,
  canApprove,
  canPost,
  onNavigate,
  onDataChanged,
}: CorporateFinanceOverviewProps) {
  const [data, setData] = useState<CorporateFinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("ytd");
  const [entityId, setEntityId] = useState(ALL_FILTER);
  const [startDate, setStartDate] = useState(
    `${new Date().getFullYear()}-01-01`,
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedJournal, setSelectedJournal] =
    useState<JournalEntryDetail | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");

  const fetchOverview = useCallback(async () => {
    if (period === "custom" && (!startDate || !endDate)) return;
    try {
      setLoading(true);
      const response = await getCorporateFinanceOverview({
        period,
        entityId: entityId === ALL_FILTER ? undefined : entityId,
        startDate: period === "custom" ? startDate : undefined,
        endDate: period === "custom" ? endDate : undefined,
      });
      setData(response.data);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Failed to load corporate finance overview",
      );
    } finally {
      setLoading(false);
    }
  }, [endDate, entityId, period, startDate]);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview, refreshKey]);

  const selectedDraftIds = useMemo(() => {
    if (!data) return [];
    const drafts = new Set(
      data.review.journals
        .filter((journal) => journal.status === "draft")
        .map((journal) => journal.id),
    );
    return [...selectedIds].filter((id) => drafts.has(id));
  }, [data, selectedIds]);

  function refreshAll() {
    setRefreshKey((key) => key + 1);
    onDataChanged();
  }

  async function handleBulkApprove() {
    if (selectedDraftIds.length === 0) return;
    try {
      setBulkBusy(true);
      const response = await bulkApproveJournals(selectedDraftIds);
      toast.success(`${response.data.updatedCount} journals approved`);
      refreshAll();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Bulk approval failed",
      );
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkReject() {
    if (selectedDraftIds.length === 0 || !bulkRejectReason.trim()) return;
    try {
      setBulkBusy(true);
      const response = await bulkRejectJournals(
        selectedDraftIds,
        bulkRejectReason.trim(),
      );
      toast.success(
        `${response.data.updatedCount} journals returned for correction`,
      );
      setBulkRejectOpen(false);
      setBulkRejectReason("");
      refreshAll();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Bulk rejection failed",
      );
    } finally {
      setBulkBusy(false);
    }
  }

  if (loading && !data) return <OverviewSkeleton />;
  if (!data) return null;

  const selectedEntity =
    entityId === ALL_FILTER ? null : (data.entities[0] ?? null);
  const periodLabel = `${formatDate(data.period.startDate)} – ${formatDate(
    data.period.endDate,
  )}`;

  return (
    <div className="space-y-5">
      <section
        className={`
          border-border/70 relative overflow-hidden rounded-xl border
          bg-[linear-gradient(125deg,var(--color-card)_0%,var(--color-cream)_180%)]
          px-5 py-5
        `}
      >
        <div
          aria-hidden
          className={`
            bg-primary/8 pointer-events-none absolute -top-16 -right-12 size-48
            rounded-full blur-3xl
          `}
        />
        <div
          className={`
            relative flex flex-col gap-4
            lg:flex-row lg:items-end lg:justify-between
          `}
        >
          <div>
            <p
              className={`
                text-primary text-[10px] font-semibold tracking-[0.2em]
                uppercase
              `}
            >
              Corporate finance review
            </p>
            <h2 className="mt-1 font-serif text-2xl tracking-tight">
              Group performance and control center
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Posted-ledger P&amp;L · {periodLabel} · Consolidated in USD
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger className="bg-background/70 h-8 w-[180px] text-xs">
                <SelectValue placeholder="All entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All entities</SelectItem>
                {entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div
              className={`
                border-border bg-background/70 flex rounded-md border p-0.5
              `}
            >
              {PERIODS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPeriod(item.id)}
                  className={`
                    rounded px-2.5 py-1.5 text-[10px] font-semibold
                    transition-colors
                    ${
                      period === item.id
                        ? "bg-foreground text-background"
                        : `
                          text-muted-foreground
                          hover:text-foreground
                        `
                    }
                  `}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Button
              size="icon-sm"
              variant="outline"
              disabled={loading}
              onClick={() => setRefreshKey((key) => key + 1)}
            >
              <RefreshCw className={loading ? "animate-spin" : ""} />
              <span className="sr-only">Refresh overview</span>
            </Button>
          </div>
        </div>
        {period === "custom" ? (
          <div className="relative mt-4 flex flex-wrap justify-end gap-2">
            <FormDatePicker
              value={startDate}
              onChange={setStartDate}
              clearable={false}
              className="bg-background/70 w-[160px]"
            />
            <FormDatePicker
              value={endDate}
              onChange={setEndDate}
              minDate={startDate}
              clearable={false}
              className="bg-background/70 w-[160px]"
            />
          </div>
        ) : null}
      </section>

      {!data.fxCompleteness.isComplete ? (
        <section
          role="alert"
          className={`
            border-warning/30 bg-warning/8 flex items-start gap-3 rounded-xl
            border px-4 py-3
          `}
        >
          <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-sm font-semibold">
              Consolidated totals exclude{" "}
              {data.fxCompleteness.excludedEntityCount}{" "}
              {data.fxCompleteness.excludedEntityCount === 1
                ? "entity"
                : "entities"}
            </p>
            <p className="text-muted-foreground text-xs">
              Missing USD conversion path for{" "}
              {data.fxCompleteness.missingCurrencies.join(", ")}. Native entity
              P&amp;L remains visible below.
            </p>
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <div>
          <p
            className={`
              text-muted-foreground text-[10px] font-semibold tracking-wider
              uppercase
            `}
          >
            Exhibit A
          </p>
          <h3 className="font-serif text-lg">Posted USD GL P&amp;L</h3>
          <p className="text-muted-foreground text-xs">
            Consolidated posted-ledger totals in USD. These are not the
            invoice-based PRD figures below.
          </p>
        </div>
        <div
          className={`
            grid gap-3
            sm:grid-cols-2
            xl:grid-cols-4
          `}
        >
          <KpiCard
            eyebrow="Revenue (USD GL)"
            value={money(data.totals.revenue)}
            icon={TrendingUp}
            tone="positive"
            detail="Posted revenue accounts"
          />
          <KpiCard
            eyebrow="Operating expense (USD GL)"
            value={money(data.totals.expenses)}
            icon={Banknote}
            detail="Posted expense accounts"
          />
          <KpiCard
            eyebrow="Net profit (USD GL)"
            value={money(data.totals.netProfit)}
            icon={Landmark}
            tone={data.totals.netProfit >= 0 ? "positive" : "negative"}
            detail={
              data.totals.netProfitChangePct === null
                ? "No comparable prior period"
                : `${signedPct(data.totals.netProfitChangePct)} vs prior period`
            }
          />
          <KpiCard
            eyebrow="Profit margin"
            value={
              data.totals.margin === null
                ? "—"
                : `${data.totals.margin.toFixed(1)}%`
            }
            icon={Scale}
            detail={`Prior net ${money(data.totals.previousNetProfit)}`}
          />
        </div>
      </section>

      <section
        className={`border-border bg-muted/20 rounded-xl border px-5 py-4`}
      >
        <div className="mb-3">
          <p
            className={`
              text-muted-foreground text-[10px] font-semibold tracking-wider
              uppercase
            `}
          >
            PRD exhibits
          </p>
          <h3 className="font-serif text-base">
            Invoice-based totals (not USD GL)
          </h3>
          <p className="text-muted-foreground text-xs">
            Pre-VAT document amounts by issue date. Unconverted (not the Exhibit
            A USD ledger figures above).
          </p>
        </div>
        <div
          className={`
            grid gap-3
            sm:grid-cols-2
          `}
        >
          <div className="border-border bg-card rounded-lg border p-4">
            <p
              className={`
                text-muted-foreground text-[10px] font-semibold tracking-wider
                uppercase
              `}
            >
              Accrual revenue (pre-VAT invoices)
            </p>
            <p className="mt-3 font-serif text-2xl font-medium tabular-nums">
              {documentTotal(data.prdExhibits?.accrualRevenue ?? 0)}
            </p>
            <p className="text-muted-foreground mt-1 text-[11px]">
              Receivable invoices in range, VAT excluded. Not posted USD
              revenue.
            </p>
          </div>
          <div className="border-border bg-card rounded-lg border p-4">
            <p
              className={`
                text-muted-foreground text-[10px] font-semibold tracking-wider
                uppercase
              `}
            >
              Operating expense (pre-VAT AP)
            </p>
            <p className="mt-3 font-serif text-2xl font-medium tabular-nums">
              {documentTotal(data.prdExhibits?.operatingExpense ?? 0)}
            </p>
            <p className="text-muted-foreground mt-1 text-[11px]">
              Payable invoices in range, VAT excluded. Not posted USD operating
              expense.
            </p>
            <div
              className={`
                border-border mt-3 flex items-baseline justify-between border-t
                pt-2
              `}
            >
              <span className="text-muted-foreground text-[11px]">
                Of which capital expenditure
              </span>
              <span className="text-sm font-medium tabular-nums">
                {documentTotal(data.prdExhibits?.capex ?? 0)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-muted-foreground text-[11px]">
                Reaches the income statement
              </span>
              <span className="text-sm font-medium tabular-nums">
                {documentTotal(data.prdExhibits?.expenseInProfitAndLoss ?? 0)}
              </span>
            </div>
            <p className="text-muted-foreground mt-2 text-[11px]">
              Capitalised lines are not an expense when bought — they reach the
              income statement later as depreciation over the asset&apos;s life.
              This is why the header figure and the income statement differ.
            </p>
          </div>
        </div>
      </section>

      <div
        className={`
          grid gap-5
          xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]
        `}
      >
        <section
          className={`border-border bg-card overflow-hidden rounded-xl border`}
        >
          <div
            className={`
              border-border flex items-center justify-between border-b px-5 py-4
            `}
          >
            <div>
              <p
                className={`
                  text-muted-foreground text-[10px] font-semibold tracking-wider
                  uppercase
                `}
              >
                Exhibit 1
              </p>
              <h3 className="font-serif text-lg">
                {selectedEntity
                  ? `${selectedEntity.entityName} P&L`
                  : "Entity performance"}
              </h3>
            </div>
            {selectedEntity ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEntityId(ALL_FILTER)}
              >
                Back to group
              </Button>
            ) : (
              <span className="text-muted-foreground text-xs">
                Native books · USD comparison
              </span>
            )}
          </div>
          {selectedEntity ? (
            <EntityPnlDetail entity={selectedEntity} />
          ) : (
            <EntityPerformanceTable
              entities={data.entities}
              onSelect={setEntityId}
            />
          )}
        </section>

        <section
          className={`border-border bg-card overflow-hidden rounded-xl border`}
        >
          <div className="border-border border-b px-5 py-4">
            <p
              className={`
                text-muted-foreground text-[10px] font-semibold tracking-wider
                uppercase
              `}
            >
              Exhibit 2
            </p>
            <h3 className="font-serif text-lg">Control tower</h3>
          </div>
          <div className="bg-border grid grid-cols-2 gap-px">
            <ControlMetric
              label="Awaiting review"
              value={data.review.counts.draft}
              icon={Clock3}
              tone="amber"
            />
            <ControlMetric
              label="Ready to post"
              value={data.review.counts.approved}
              icon={CheckCircle2}
              tone="green"
            />
            <ControlMetric
              label="Needs correction"
              value={data.review.counts.rejected}
              icon={XCircle}
              tone="red"
            />
            <ControlMetric
              label="Stale drafts"
              value={data.review.counts.staleDrafts}
              icon={AlertTriangle}
              tone="red"
            />
          </div>
          <div className="border-border border-t px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Exceptions</span>
              <span className="text-muted-foreground text-[10px]">
                Immediate follow-up
              </span>
            </div>
            <ExceptionLink
              icon={FileWarning}
              label="Overdue invoices"
              value={data.exceptions.overdueInvoices.count}
              onClick={() => onNavigate("invoices")}
            />
            <ExceptionLink
              icon={Landmark}
              label="Unmatched bank transactions"
              value={data.exceptions.unmatchedBank.count}
              onClick={() => onNavigate("bank")}
            />
          </div>
        </section>
      </div>

      <section
        className={`border-border bg-card overflow-hidden rounded-xl border`}
      >
        <div
          className={`
            border-border flex flex-col gap-3 border-b px-5 py-4
            sm:flex-row sm:items-center sm:justify-between
          `}
        >
          <div>
            <p
              className={`
                text-muted-foreground text-[10px] font-semibold tracking-wider
                uppercase
              `}
            >
              Exhibit 3
            </p>
            <h3 className="font-serif text-lg">Finance review queue</h3>
            <p className="text-muted-foreground text-xs">
              Oldest open journals first. Open detail before individual action.
            </p>
          </div>
          {canApprove && selectedDraftIds.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {selectedDraftIds.length} selected
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={bulkBusy}
                onClick={() => setBulkRejectOpen(true)}
              >
                Reject
              </Button>
              <Button
                size="sm"
                disabled={bulkBusy}
                onClick={() => void handleBulkApprove()}
              >
                {bulkBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                Approve
              </Button>
            </div>
          ) : null}
        </div>
        <ReviewQueue
          journals={data.review.journals}
          selectedIds={selectedIds}
          selectable={canApprove}
          onSelectionChange={setSelectedIds}
          onOpen={setSelectedJournal}
        />
      </section>

      <div
        className={`
          grid gap-5
          lg:grid-cols-2
        `}
      >
        <ExceptionList
          title="Overdue receivables and payables"
          items={data.exceptions.overdueInvoices.items.map((invoice) => ({
            id: invoice.id,
            primary: invoice.counterparty,
            secondary: `${invoice.entity.name} · Due ${formatDate(
              invoice.dueDate,
            )}`,
            value: money(invoice.amount, invoice.currency),
            status: invoice.status,
          }))}
          empty="No overdue invoices"
          onViewAll={() => onNavigate("invoices")}
        />
        <ExceptionList
          title="Unmatched cash movements"
          items={data.exceptions.unmatchedBank.items.map((transaction) => ({
            id: transaction.id,
            primary: transaction.description,
            secondary: `${transaction.entity.name} · ${formatDate(
              transaction.date,
            )}`,
            value: money(
              transaction.amount,
              transaction.entity.currency ?? "USD",
            ),
            status: transaction.status,
          }))}
          empty="No unmatched transactions"
          onViewAll={() => onNavigate("bank")}
        />
      </div>

      <JournalReviewSheet
        journal={selectedJournal}
        open={Boolean(selectedJournal)}
        onOpenChange={(open) => {
          if (!open) setSelectedJournal(null);
        }}
        canApprove={canApprove}
        canPost={canPost}
        onChanged={refreshAll}
      />

      <Dialog open={bulkRejectOpen} onOpenChange={setBulkRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject selected journals</DialogTitle>
            <DialogDescription>
              One correction reason will be applied to {selectedDraftIds.length}{" "}
              selected draft journals.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={bulkRejectReason}
            onChange={(event) => setBulkRejectReason(event.target.value)}
            placeholder="Explain required correction…"
            maxLength={1000}
          />
          <DialogFooter className="-mx-4 -mb-4">
            <Button variant="outline" onClick={() => setBulkRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!bulkRejectReason.trim() || bulkBusy}
              onClick={() => void handleBulkReject()}
            >
              Reject selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({
  eyebrow,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  eyebrow: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="border-border bg-card rounded-xl border p-4">
      <div className="flex items-start justify-between">
        <p
          className={`
            text-muted-foreground text-[10px] font-semibold tracking-wider
            uppercase
          `}
        >
          {eyebrow}
        </p>
        <Icon
          className={
            tone === "positive"
              ? "text-success size-4"
              : tone === "negative"
                ? "text-destructive size-4"
                : "text-primary size-4"
          }
        />
      </div>
      <p className="mt-3 font-serif text-2xl font-medium tabular-nums">
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-[11px]">{detail}</p>
    </div>
  );
}

function ControlMetric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "amber" | "green" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "text-success bg-success/10"
      : tone === "red"
        ? "text-destructive bg-destructive/10"
        : "text-warning bg-warning/10";
  return (
    <div className="bg-card p-4">
      <div
        className={`
          mb-3 flex size-7 items-center justify-center rounded
          ${toneClass}
        `}
      >
        <Icon className="size-3.5" />
      </div>
      <p className="font-serif text-xl tabular-nums">{value}</p>
      <p className="text-muted-foreground text-[10px]">{label}</p>
    </div>
  );
}

function ExceptionLink({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        border-border/70 mt-2 flex w-full items-center gap-3 rounded-lg border
        px-3 py-2.5 text-left transition-colors
        hover:bg-muted/30
      `}
    >
      <Icon className="text-primary size-4" />
      <span className="flex-1 text-xs">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
      <ArrowRight className="text-muted-foreground size-3.5" />
    </button>
  );
}

function EntityPerformanceTable({
  entities,
  onSelect,
}: {
  entities: CorporateFinanceOverview["entities"];
  onSelect: (entityId: string) => void;
}) {
  if (entities.length === 0) {
    return <EmptyState message="No posted P&L activity in selected period" />;
  }
  const maxRevenue = Math.max(
    ...entities.map((entity) => entity.revenueUsd),
    1,
  );
  return (
    <div className="divide-border divide-y">
      {entities.map((entity) => (
        <button
          type="button"
          key={entity.entityId}
          onClick={() => onSelect(entity.entityId)}
          className={`
            hover:bg-muted/20
            grid w-full grid-cols-[1.2fr_1fr_1fr_auto] items-center gap-4 px-5
            py-4 text-left transition-colors
          `}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{entity.entityName}</p>
            <p className="text-muted-foreground text-[10px]">
              {entity.currency} ·{" "}
              {entity.fxSource === "missing"
                ? "Missing USD rate"
                : `FX ${entity.fxRate.toFixed(4)}`}
            </p>
            <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full"
                style={{
                  width: `${Math.max(
                    3,
                    (entity.revenueUsd / maxRevenue) * 100,
                  )}%`,
                }}
              />
            </div>
          </div>
          <ValueCell label="Revenue" value={money(entity.revenueUsd)} />
          <ValueCell
            label="Net profit"
            value={money(entity.netProfitUsd)}
            tone={entity.netProfitUsd >= 0 ? "positive" : "negative"}
          />
          <div className="flex items-center gap-2">
            <Change value={entity.netProfitChangePct} />
            <ArrowRight className="text-muted-foreground size-4" />
          </div>
        </button>
      ))}
    </div>
  );
}

function EntityPnlDetail({
  entity,
}: {
  entity: CorporateFinanceOverview["entities"][number];
}) {
  const revenue = entity.accounts.filter(
    (account) => account.type === "revenue",
  );
  const expenses = entity.accounts.filter(
    (account) => account.type === "expense",
  );
  return (
    <div className="p-5">
      <div className="mb-5 grid grid-cols-3 gap-3">
        <ValueBlock
          label="Revenue"
          value={money(entity.revenue, entity.currency)}
        />
        <ValueBlock
          label="Expenses"
          value={money(entity.expenses, entity.currency)}
        />
        <ValueBlock
          label="Net"
          value={money(entity.netProfit, entity.currency)}
        />
      </div>
      <PnlSection
        title="Revenue"
        accounts={revenue}
        currency={entity.currency}
      />
      <PnlSection
        title="Operating expenses"
        accounts={expenses}
        currency={entity.currency}
      />
      <div
        className={`
          border-foreground/20 mt-3 flex items-center justify-between border-t-2
          pt-3
        `}
      >
        <span className="font-serif text-base">Net profit</span>
        <span className="font-serif text-lg tabular-nums">
          {money(entity.netProfit, entity.currency)}
        </span>
      </div>
    </div>
  );
}

function PnlSection({
  title,
  accounts,
  currency,
}: {
  title: string;
  accounts: CorporateFinanceOverview["entities"][number]["accounts"];
  currency: string;
}) {
  return (
    <div className="mb-5">
      <p
        className={`
          text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider
          uppercase
        `}
      >
        {title}
      </p>
      <div className="divide-border divide-y">
        {accounts.map((account) => (
          <div
            key={account.accountId}
            className="flex justify-between py-2 text-xs"
          >
            <span>
              <span className="text-muted-foreground mr-2 font-mono">
                {account.code}
              </span>
              {account.name}
            </span>
            <span className="tabular-nums">
              {money(account.amount, currency)}
            </span>
          </div>
        ))}
        {accounts.length === 0 ? (
          <p className="text-muted-foreground py-3 text-xs">No activity</p>
        ) : null}
      </div>
    </div>
  );
}

function ReviewQueue({
  journals,
  selectedIds,
  selectable,
  onSelectionChange,
  onOpen,
}: {
  journals: JournalEntryDetail[];
  selectedIds: Set<string>;
  selectable: boolean;
  onSelectionChange: (ids: Set<string>) => void;
  onOpen: (journal: JournalEntryDetail) => void;
}) {
  if (journals.length === 0) {
    return <EmptyState message="No journals require finance review" />;
  }
  return (
    <div className="divide-border divide-y">
      {journals.map((journal) => {
        const age = Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(journal.createdAt).getTime()) / 86_400_000,
          ),
        );
        return (
          <div
            key={journal.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(journal)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onOpen(journal);
            }}
            className={`
              hover:bg-muted/20
              grid cursor-pointer grid-cols-[auto_minmax(0,1.4fr)_1fr_1fr_auto]
              items-center gap-4 px-5 py-3 transition-colors
            `}
          >
            {selectable && journal.status === "draft" ? (
              <Checkbox
                checked={selectedIds.has(journal.id)}
                onClick={(event) => event.stopPropagation()}
                onCheckedChange={(checked) => {
                  const next = new Set(selectedIds);
                  if (checked) next.add(journal.id);
                  else next.delete(journal.id);
                  onSelectionChange(next);
                }}
                aria-label={`Select ${journal.reference}`}
              />
            ) : (
              <span className="w-4" />
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">
                {journal.reference || journal.id}
              </p>
              <p className="text-muted-foreground truncate text-[10px]">
                {journal.description ??
                  journal.descriptionTh ??
                  "No description"}
              </p>
            </div>
            <div>
              <p className="text-xs">{journal.entity.name}</p>
              <p className="text-muted-foreground text-[10px]">
                {journal.creator.name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs tabular-nums">
                {money(Number(journal.totalDebit), journal.entity.currency)}
              </p>
              <p
                className={
                  age > 7
                    ? "text-destructive text-[10px]"
                    : "text-muted-foreground text-[10px]"
                }
              >
                {age} days open
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge status={journal.status}>{journal.status}</Badge>
              <ArrowRight className="text-muted-foreground size-3.5" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExceptionList({
  title,
  items,
  empty,
  onViewAll,
}: {
  title: string;
  items: Array<{
    id: string;
    primary: string;
    secondary: string;
    value: string;
    status: string;
  }>;
  empty: string;
  onViewAll: () => void;
}) {
  return (
    <section className="border-border bg-card overflow-hidden rounded-xl border">
      <div
        className={`
          border-border flex items-center justify-between border-b px-5 py-4
        `}
      >
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        <Button variant="ghost" size="sm" onClick={onViewAll}>
          View all <ArrowRight className="size-3.5" />
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState message={empty} compact />
      ) : (
        <div className="divide-border divide-y">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{item.primary}</p>
                <p className="text-muted-foreground truncate text-[10px]">
                  {item.secondary}
                </p>
              </div>
              <span className="text-xs font-medium tabular-nums">
                {item.value}
              </span>
              <Badge status={item.status}>{item.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ValueCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div>
      <p className="text-muted-foreground text-[9px] uppercase">{label}</p>
      <p
        className={`
          text-xs font-medium tabular-nums
          ${
            tone === "positive"
              ? "text-success"
              : tone === "negative"
                ? "text-destructive"
                : ""
          }
        `}
      >
        {value}
      </p>
    </div>
  );
}

function ValueBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-muted-foreground text-[9px] uppercase">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Change({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-muted-foreground text-[10px]">New</span>;
  }
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`
        flex items-center text-[10px] font-semibold
        ${positive ? "text-success" : "text-destructive"}
      `}
    >
      <Icon className="size-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function EmptyState({
  message,
  compact = false,
}: {
  message: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`
        text-muted-foreground flex items-center justify-center text-xs
        ${compact ? "h-24" : "h-36"}
      `}
    >
      {message}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5">
      <div className="bg-muted/50 h-28 animate-pulse rounded-xl" />
      <div
        className={`
          grid gap-3
          sm:grid-cols-2
          xl:grid-cols-4
        `}
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="bg-muted/50 h-28 animate-pulse rounded-xl"
          />
        ))}
      </div>
      <div className="bg-muted/50 h-80 animate-pulse rounded-xl" />
    </div>
  );
}

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function documentTotal(value: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function signedPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}
