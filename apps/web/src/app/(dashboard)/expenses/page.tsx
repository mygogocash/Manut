"use client";

import {
  Bell,
  Loader2,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ExchangeRatesManagerDialog } from "@/components/crm/exchange-rates-manager-dialog";
import { ExpenseAlertConfigDialog } from "@/components/expenses/expense-alert-config-dialog";
import { ExpenseMonthlySummary } from "@/components/expenses/expense-monthly-summary";
import { ExpenseReportFormDialog } from "@/components/expenses/expense-report-form-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/shared/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { useAuth } from "@/providers/auth-provider";
import {
  type Entity,
  listExpenseFormEntities,
} from "@/services/entity.service";
import {
  deleteExpenseReport,
  EXPENSE_STATUS_LABELS,
  type ExpenseReportStatus,
  type ExpenseReportSummary,
  listExpenseReports,
  OFFICE_ADMIN_SUBMITTER_LABEL,
  submitterDisplayName,
} from "@/services/expense.service";

const ALL_FILTER = "__all__";

const STATUS_VARIANT: Record<
  ExpenseReportStatus,
  "grey" | "blue" | "green" | "red" | "amber" | "gold"
> = {
  draft: "grey",
  submitted: "blue",
  approved: "green",
  rejected: "red",
  payroll_processed: "amber",
  reimbursed: "gold",
};

const STATUS_OPTIONS: Array<{ value: ExpenseReportStatus; label: string }> = (
  [
    "draft",
    "submitted",
    "approved",
    "rejected",
    "payroll_processed",
    "reimbursed",
  ] as const
).map((value) => ({ value, label: EXPENSE_STATUS_LABELS[value] }));

// Delegates to the shared resilient formatter so a legacy row whose
// `currency` is a glyph (e.g. `₹`) doesn't white-screen the page —
// see apps/web/src/lib/format-currency.ts for the symbol→ISO map.
function formatAmount(value: number, currency: string) {
  return formatCurrency(value, currency || "THB");
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// "2026-06" → "June 2026" for the active-month chip. Falls back to the raw
// period for an unexpected value.
function formatPeriodLabel(period: string) {
  const date = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export default function ExpensesPage() {
  const router = useRouter();
  const { user, hasAnyPermission, hasPermission, isEmployeeOnly } = useAuth();
  const canAdminDelete = hasPermission("expense:hr-delete");

  // Employee-only accounts must never see other people's expense reports
  // regardless of stray permission grants. The page surfaces tabs that
  // widen scope (`Pending approval`, `All reports`) only for users whose
  // role set includes something beyond `Employee`.
  const canApprove =
    !isEmployeeOnly &&
    hasAnyPermission("expense:approve", "expense:hr-approve");
  const canViewAll = !isEmployeeOnly && hasAnyPermission("expense:hr-read");
  const canManageApprovals =
    !isEmployeeOnly && hasAnyPermission("expense:assign-approver");
  const canManageAlerts =
    !isEmployeeOnly && hasPermission("expense:hr-settings");
  // Exchange rates are accounting-owned; reports convert foreign lines
  // to THB via them, so surface the manager here too (not just in the
  // investor pipeline) for whoever can edit rates.
  const canManageFx = hasPermission("accounting:admin");

  // Persist the active tab in the URL (?tab=) so returning from a report
  // detail restores the same tab instead of resetting to the role default
  // (approvers default to "pending"). Validate the param against the tabs
  // this user may actually see — an employee can't force ?tab=all.
  const searchParams = useSearchParams();
  const requestedTab = searchParams?.get("tab");
  // Persist the All-reports page in the URL (?page=) so returning from a
  // report detail (or browser-back) restores the page the user was on
  // instead of resetting to page 1. Seed it into usePagination's
  // initialPage; an out-of-range/non-numeric value falls back to 1 here and
  // is clamped down after the first fetch (see the clamp effect below).
  const requestedPage = Number.parseInt(searchParams?.get("page") ?? "", 10);
  const initialAllPage =
    Number.isFinite(requestedPage) && requestedPage > 1 ? requestedPage : 1;
  // Persist the All-reports month drill-down in the URL (?period=YYYY-MM) so a
  // clicked month survives detail navigation / deep-links. "" = all months.
  const requestedPeriod = searchParams?.get("period") ?? "";
  const initialPeriod = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedPeriod)
    ? requestedPeriod
    : "";
  const initialTab =
    requestedTab === "my" ||
    (requestedTab === "pending" && canApprove) ||
    (requestedTab === "all" && canViewAll)
      ? requestedTab
      : canApprove
        ? "pending"
        : "my";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [alertConfigOpen, setAlertConfigOpen] = useState(false);
  const [fxOpen, setFxOpen] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);

  const [statusFilter, setStatusFilter] = useState<string>(ALL_FILTER);
  // All-reports month drill-down ("" = all months). Seeded from ?period=.
  const [periodFilter, setPeriodFilter] = useState(initialPeriod);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseReportSummary | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  // ── My reports ─────────────────────
  const myPagination = usePagination();
  const [myReports, setMyReports] = useState<ExpenseReportSummary[]>([]);
  const [loadingMy, setLoadingMy] = useState(true);

  // ── Pending approvals ──────────────
  const pendingPagination = usePagination();
  const [pendingReports, setPendingReports] = useState<ExpenseReportSummary[]>(
    [],
  );
  const [loadingPending, setLoadingPending] = useState(canApprove);

  // ── All reports (HR) ───────────────
  const allPagination = usePagination({ initialPage: initialAllPage });
  const [allReports, setAllReports] = useState<ExpenseReportSummary[]>([]);
  const [loadingAll, setLoadingAll] = useState(canViewAll);

  useEffect(() => {
    listExpenseFormEntities()
      .then((res) => setEntities(res.data))
      .catch(() =>
        toast.error("Couldn't load company entities — try refreshing."),
      );
  }, []);

  // `usePagination` returns a fresh object each render, so destructure
  // the primitives we actually need into stable identities. Without
  // this each `fetch*` callback's identity changed every render, the
  // tab effect below fired in a loop, and the loading skeleton never
  // resolved.
  const myPage = myPagination.page;
  const myPageSize = myPagination.pageSize;
  const setMyTotal = myPagination.setTotalCount;
  const pendingPage = pendingPagination.page;
  const pendingPageSize = pendingPagination.pageSize;
  const setPendingTotal = pendingPagination.setTotalCount;
  const allPage = allPagination.page;
  const allPageSize = allPagination.pageSize;
  const setAllTotal = allPagination.setTotalCount;
  // Destructure to a stable identity (usePagination returns a fresh object
  // each render) so setAllPageWithUrl + the clamp effect don't re-create
  // every render and loop — same convention as the page-state destructures
  // above.
  const setAllPage = allPagination.setPage;
  const allTotalPages = allPagination.totalPages;
  const allTotalCount = allPagination.totalCount;

  // Single writer for the All-reports URL — page + month filter from one
  // source so neither param clobbers the other. ?tab=all always present;
  // page 1 and empty period are omitted to keep the default URL clean.
  const replaceAllUrl = useCallback(
    (nextPage: number, nextPeriod: string) => {
      const params = new URLSearchParams();
      params.set("tab", "all");
      if (nextPeriod) params.set("period", nextPeriod);
      if (nextPage > 1) params.set("page", String(nextPage));
      router.replace(`/expenses?${params.toString()}`);
    },
    [router],
  );

  // Advance the page + persist it (preserving the active month filter).
  const setAllPageWithUrl = useCallback(
    (next: number) => {
      setAllPage(next);
      replaceAllUrl(next, periodFilter);
    },
    [setAllPage, replaceAllUrl, periodFilter],
  );

  // Drill into a month from the Monthly overview (or clear by re-selecting it).
  // Resets to page 1 — a high page is meaningless against a narrower month.
  const selectPeriod = useCallback(
    (p: string) => {
      const next = p === periodFilter ? "" : p;
      setPeriodFilter(next);
      setAllPage(1);
      replaceAllUrl(1, next);
    },
    [periodFilter, setAllPage, replaceAllUrl],
  );

  // Clamp a deep-linked / restored page that is now out of range (e.g.
  // ?page=9999, or a status filter shrank the result set). MUST wait for the
  // first fetch to resolve — totalPages is 1 until then, so an un-gated clamp
  // would collapse a restored page 9 to 1 before fetchAll ever runs.
  useEffect(() => {
    if (
      activeTab === "all" &&
      !loadingAll &&
      allTotalCount > 0 &&
      allPage > allTotalPages
    ) {
      setAllPageWithUrl(allTotalPages);
    }
  }, [
    activeTab,
    loadingAll,
    allTotalCount,
    allTotalPages,
    allPage,
    setAllPageWithUrl,
  ]);

  const fetchMy = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoadingMy(true);
      // Always pin to the current user's id. The backend only force-
      // scopes non-HR callers; without this an HR/admin viewing the
      // "My reports" tab saw everyone's reports because the backend
      // treats a missing employeeId as "all reports" for them.
      const res = await listExpenseReports({
        page: myPage,
        limit: myPageSize,
        employeeId: user.id,
        status:
          statusFilter !== ALL_FILTER
            ? (statusFilter as ExpenseReportStatus)
            : undefined,
      });
      setMyReports(res.data);
      setMyTotal(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load reports";
      toast.error(msg);
    } finally {
      setLoadingMy(false);
    }
  }, [user?.id, myPage, myPageSize, setMyTotal, statusFilter]);

  const fetchPending = useCallback(async () => {
    if (!canApprove) return;
    try {
      setLoadingPending(true);
      const res = await listExpenseReports({
        page: pendingPage,
        limit: pendingPageSize,
        pendingForMe: true,
      });
      setPendingReports(res.data);
      setPendingTotal(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load approvals";
      toast.error(msg);
    } finally {
      setLoadingPending(false);
    }
  }, [pendingPage, pendingPageSize, setPendingTotal, canApprove]);

  const fetchAll = useCallback(async () => {
    if (!canViewAll) return;
    try {
      setLoadingAll(true);
      const res = await listExpenseReports({
        page: allPage,
        limit: allPageSize,
        // Backend now scopes to self by default; HR has to opt into
        // the workspace-wide view explicitly.
        includeAll: true,
        status:
          statusFilter !== ALL_FILTER
            ? (statusFilter as ExpenseReportStatus)
            : undefined,
        period: periodFilter || undefined,
      });
      setAllReports(res.data);
      setAllTotal(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load reports";
      toast.error(msg);
    } finally {
      setLoadingAll(false);
    }
  }, [
    allPage,
    allPageSize,
    setAllTotal,
    statusFilter,
    periodFilter,
    canViewAll,
  ]);

  useEffect(() => {
    if (activeTab === "my") void fetchMy();
    if (activeTab === "pending") void fetchPending();
    if (activeTab === "all") void fetchAll();
  }, [activeTab, fetchMy, fetchPending, fetchAll]);

  const filterReports = useCallback(
    (rows: ExpenseReportSummary[]) => {
      const q = debouncedSearch.trim().toLowerCase();
      if (!q) return rows;
      const officeLabel = OFFICE_ADMIN_SUBMITTER_LABEL.toLowerCase();
      return rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.period.toLowerCase().includes(q) ||
          // Office reports mask the submitter — match the visible label
          // instead of the underlying employee name so a search for
          // "Office Admin" still surfaces them.
          (r.category === "office"
            ? officeLabel.includes(q)
            : r.employee.name.toLowerCase().includes(q)),
      );
    },
    [debouncedSearch],
  );

  const myFiltered = useMemo(
    () => filterReports(myReports),
    [myReports, filterReports],
  );
  const pendingFiltered = useMemo(
    () => filterReports(pendingReports),
    [pendingReports, filterReports],
  );
  const allFiltered = useMemo(
    () => filterReports(allReports),
    [allReports, filterReports],
  );

  const tabsList = useMemo(() => {
    const base = [{ id: "my", label: "My reports" }];
    if (canApprove) base.push({ id: "pending", label: "Pending approvals" });
    if (canViewAll) base.push({ id: "all", label: "All reports" });
    return base;
  }, [canApprove, canViewAll]);

  const reportColumns = useMemo(
    () => [
      {
        key: "period",
        header: "Period",
        render: (r: ExpenseReportSummary) => (
          <span className="font-mono text-[12px]">{r.period}</span>
        ),
      },
      {
        key: "title",
        header: "Title",
        render: (r: ExpenseReportSummary) => (
          <div>
            <div className="font-medium">{r.title}</div>
            <div className="text-muted-foreground text-[11px]">
              {submitterDisplayName(r)}
            </div>
          </div>
        ),
      },
      {
        key: "expenses",
        header: "Expenses",
        render: (r: ExpenseReportSummary) => String(r._count?.expenses ?? 0),
      },
      {
        key: "total",
        header: "Total",
        className: "text-right",
        render: (r: ExpenseReportSummary) => {
          // Mixed-currency report with an unpriced currency: no THB
          // total is computable, so show the gap instead of a wrong sum.
          if (r.converted === false) {
            return (
              <span className="text-muted-foreground text-xs">
                — rate missing
              </span>
            );
          }
          const currency = r.totalCurrency ?? "THB";
          const submitted = formatAmount(r.totalAmount ?? 0, currency);
          if (r.approvedTotal === null || r.approvedTotal === undefined) {
            return submitted;
          }
          const approved = formatAmount(r.approvedTotal, currency);
          // Show approved amount with the submitted total struck through
          // when finance haircut it. Same currency, so a glance reads as
          // "approved X (was Y)".
          if (r.approvedTotal === r.totalAmount) return submitted;
          return (
            <span className="inline-flex flex-col items-end leading-tight">
              <span>{approved}</span>
              <span className="text-muted-foreground text-[11px] line-through">
                {submitted}
              </span>
            </span>
          );
        },
      },
      {
        key: "submittedAt",
        header: "Submitted",
        render: (r: ExpenseReportSummary) => formatDate(r.submittedAt),
      },
      {
        key: "status",
        header: "Status",
        render: (r: ExpenseReportSummary) => (
          <Badge variant={STATUS_VARIANT[r.status] ?? "grey"}>
            {EXPENSE_STATUS_LABELS[r.status] ?? r.status}
          </Badge>
        ),
      },
      {
        key: "actions",
        header: "",
        className: "text-right",
        // Two delete paths:
        //   * Owner self-delete — draft / rejected only. Mirrors the
        //     pre-admin behaviour so HR-less employees still see the
        //     trash icon on their own undecided reports.
        //   * Admin delete (`expense:hr-delete`) — any row, any status,
        //     any owner. Server-side `deleteReport` enforces the same
        //     split; this is a UI hint so the icon only appears when
        //     the action will succeed.
        render: (r: ExpenseReportSummary) => {
          const ownerCanDelete =
            r.employee.id === user?.id &&
            (r.status === "draft" || r.status === "rejected");
          const showDelete = ownerCanDelete || canAdminDelete;
          if (!showDelete) return null;
          return (
            <Button
              size="sm"
              variant="ghost"
              aria-label="Delete report"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(r);
              }}
            >
              <Trash2 className="text-destructive size-3.5" />
            </Button>
          );
        },
      },
    ],
    [user?.id, canAdminDelete],
  );

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteExpenseReport(deleteTarget.id);
      toast.success("Report deleted");
      setDeleteTarget(null);
      // Refetch whichever tab the user is on. The other tabs will
      // refetch lazily when they next become active.
      if (activeTab === "my") void fetchMy();
      if (activeTab === "pending") void fetchPending();
      if (activeTab === "all") void fetchAll();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Delete failed";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Expense Management"
        subtitle="Group your monthly expenses into a single report and submit to your line manager."
      >
        {canManageAlerts && (
          <Button variant="outline" onClick={() => setAlertConfigOpen(true)}>
            <Bell className="mr-1 size-3.5" />
            Alert settings
          </Button>
        )}
        {canManageApprovals && (
          <Button variant="outline" asChild>
            <Link href="/expenses/approval">
              <Settings2 className="mr-1 size-3.5" />
              Approval chain
            </Link>
          </Button>
        )}
        {canManageFx && (
          <Button variant="outline" onClick={() => setFxOpen(true)}>
            <Settings2 className="mr-1 size-3.5" />
            FX rates
          </Button>
        )}
        <Button
          onClick={() => setCreateOpen(true)}
          disabled={entities.length === 0}
        >
          <Plus className="mr-1 size-3.5" />
          New report
        </Button>
      </PageHeader>

      <div
        className={`
          flex flex-col gap-2
          sm:flex-row sm:items-center
        `}
      >
        <div className="relative flex-1">
          <Search
            className={`
              text-muted-foreground absolute top-1/2 left-2.5 size-3.5
              -translate-y-1/2
            `}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, period, employee…"
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs
        tabs={tabsList}
        active={activeTab}
        onChange={(id) => {
          setActiveTab(id);
          // Period is an All-tab-only filter; clear it (and the URL) on tab
          // switch so state can't desync from the dropped ?period= param.
          setPeriodFilter("");
          router.replace(`/expenses?tab=${id}`);
        }}
      >
        <TabsContent value="my">
          <DataTable
            columns={reportColumns}
            data={myFiltered}
            loading={loadingMy}
            emptyMessage="You have no reports yet — click New report to start."
            onRowClick={(r) =>
              router.push(`/expenses/${(r as ExpenseReportSummary).id}?from=my`)
            }
            pagination={
              <DataPagination
                page={myPagination.page}
                pageSize={myPagination.pageSize}
                totalCount={myPagination.totalCount}
                totalPages={myPagination.totalPages}
                onPageChange={myPagination.setPage}
                onPageSizeChange={myPagination.setPageSize}
              />
            }
          />
        </TabsContent>

        {canApprove && (
          <TabsContent value="pending">
            <DataTable
              columns={reportColumns}
              data={pendingFiltered}
              loading={loadingPending}
              emptyMessage="Nothing waiting on you — direct reports submit reports here."
              onRowClick={(r) =>
                router.push(
                  `/expenses/${(r as ExpenseReportSummary).id}?from=pending`,
                )
              }
              pagination={
                <DataPagination
                  page={pendingPagination.page}
                  pageSize={pendingPagination.pageSize}
                  totalCount={pendingPagination.totalCount}
                  totalPages={pendingPagination.totalPages}
                  onPageChange={pendingPagination.setPage}
                  onPageSizeChange={pendingPagination.setPageSize}
                />
              }
            />
          </TabsContent>
        )}

        {canViewAll && (
          <TabsContent value="all">
            <ExpenseMonthlySummary
              statusFilter={
                statusFilter !== ALL_FILTER
                  ? (statusFilter as ExpenseReportStatus)
                  : undefined
              }
              selectedPeriod={periodFilter || undefined}
              onSelectPeriod={selectPeriod}
            />
            {periodFilter ? (
              <div className="mb-3 flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Viewing</span>
                <span className="font-medium">
                  {formatPeriodLabel(periodFilter)}
                </span>
                <button
                  type="button"
                  onClick={() => selectPeriod(periodFilter)}
                  className={`
                    text-muted-foreground inline-flex items-center gap-1
                    rounded-full border px-2 py-0.5 text-xs
                    hover:text-foreground hover:border-foreground/30
                  `}
                >
                  <X className="size-3" />
                  Show all months
                </button>
              </div>
            ) : null}
            <DataTable
              columns={reportColumns}
              data={allFiltered}
              loading={loadingAll}
              emptyMessage="No reports in the workspace yet."
              onRowClick={(r) =>
                router.push(
                  // Carry page + month filter so the detail "All reports"
                  // back-link returns to the same filtered + paged view.
                  `/expenses/${(r as ExpenseReportSummary).id}?from=all${
                    allPagination.page > 1 ? `&page=${allPagination.page}` : ""
                  }${periodFilter ? `&period=${periodFilter}` : ""}`,
                )
              }
              pagination={
                <DataPagination
                  page={allPagination.page}
                  pageSize={allPagination.pageSize}
                  totalCount={allPagination.totalCount}
                  totalPages={allPagination.totalPages}
                  onPageChange={setAllPageWithUrl}
                  onPageSizeChange={allPagination.setPageSize}
                />
              }
            />
          </TabsContent>
        )}
      </Tabs>

      <ExpenseAlertConfigDialog
        open={alertConfigOpen}
        onOpenChange={setAlertConfigOpen}
      />

      <ExchangeRatesManagerDialog
        open={fxOpen}
        onOpenChange={setFxOpen}
        // A new/edited rate changes report THB totals → refetch the
        // active tab so "— rate missing" / amounts re-roll without a
        // hard refresh.
        onMutated={() => {
          if (activeTab === "all") void fetchAll();
          if (activeTab === "my") void fetchMy();
          if (activeTab === "pending") void fetchPending();
        }}
      />

      <ExpenseReportFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        entities={entities}
        onSaved={(report) => {
          router.push(`/expenses/${report.id}?from=${activeTab}`);
        }}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (!deleting && !next) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.title}" will be removed and its approval history wiped. Individual expense lines stay in the ledger (with no report attached) so finance audit isn't lost. This can't be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-1 size-3.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
