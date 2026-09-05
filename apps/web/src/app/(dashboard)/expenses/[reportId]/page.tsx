"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Check,
  Edit,
  Loader2,
  Plus,
  Send,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ExpenseRowFormDialog } from "@/components/expenses/expense-row-form-dialog";
import { reportTotalCurrency } from "@/components/expenses/report-total-currency";
import { Badge } from "@/components/shared/badge";
import { PageHeader } from "@/components/shared/page-header";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import {
  approveExpenseReport,
  type Expense,
  EXPENSE_STATUS_LABELS,
  type ExpenseCategory,
  type ExpenseReportDetail,
  type ExpenseReportStatus,
  getExpenseReceiptUrl,
  getExpenseReport,
  listExpenseCategories,
  markExpenseReportPayrollProcessed,
  reimburseExpenseReport,
  rejectExpenseReport,
  removeExpenseFromReport,
  revertExpenseReportReimbursement,
  submitExpenseReport,
  submitterDisplayName,
} from "@/services/expense.service";

type ExpenseSortKey =
  | "date"
  | "description"
  | "category"
  | "amount"
  | "receipt";
type ExpenseSort = { key: ExpenseSortKey; dir: "asc" | "desc" };

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

// Delegates to the shared resilient formatter so a legacy row whose
// `currency` is a glyph (e.g. `₹`) doesn't white-screen the detail
// page — see apps/web/src/lib/format-currency.ts.
function formatAmount(value: number, currency: string) {
  return formatCurrency(value, currency || "THB");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// FX rates span tiny (1 IDR ≈ 0.00183 THB) to large (1 USD ≈ 36.4 THB),
// so format on significant figures rather than fixed decimals — 4 sig
// figs reads cleanly at both ends.
function formatRate(rate: number) {
  return new Intl.NumberFormat("en-US", {
    maximumSignificantDigits: 4,
  }).format(rate);
}

export default function ExpenseReportDetailPage() {
  const router = useRouter();
  const params = useParams<{ reportId: string }>();
  const reportId = params?.reportId ?? "";
  const { user, hasAnyPermission } = useAuth();

  // The list page stamps which tab the user left from (?from=my|pending|all)
  // so "Back" returns to that exact tab. Without it the list remounts and
  // resets to its role default (approvers → Pending approvals), which is why
  // returning from an All-reports row used to land on the wrong tab.
  const searchParams = useSearchParams();
  const fromTab = searchParams?.get("from");
  // The All-reports list stamps ?page= when the user left from a page > 1,
  // so "Back" returns to that exact page instead of resetting to page 1.
  const fromPageRaw = Number.parseInt(searchParams?.get("page") ?? "", 10);
  const fromPage =
    Number.isFinite(fromPageRaw) && fromPageRaw > 1 ? fromPageRaw : null;
  // Month drill-down on the All tab — carried back so the filtered view restores.
  const fromPeriodRaw = searchParams?.get("period") ?? "";
  const fromPeriod = /^\d{4}-(0[1-9]|1[0-2])$/.test(fromPeriodRaw)
    ? fromPeriodRaw
    : null;
  const backHref =
    fromTab === "my" || fromTab === "pending" || fromTab === "all"
      ? `/expenses?tab=${fromTab}${
          fromTab === "all" && fromPeriod ? `&period=${fromPeriod}` : ""
        }${fromTab === "all" && fromPage ? `&page=${fromPage}` : ""}`
      : "/expenses";
  const backLabel =
    fromTab === "pending"
      ? "Pending approvals"
      : fromTab === "my"
        ? "My reports"
        : "All reports";

  const [report, setReport] = useState<ExpenseReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  // Click a column header to sort the line items; click again to flip
  // direction. `null` keeps the report's original (insertion) order.
  const [sort, setSort] = useState<ExpenseSort | null>(null);

  const [rowFormOpen, setRowFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Expense | null>(null);
  const [removing, setRemoving] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  // Pre-fills with the submitted total when the dialog opens. Empty
  // string = approver accepts the full amount (no haircut sent).
  const [approveAmountInput, setApproveAmountInput] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [reimbursing, setReimbursing] = useState(false);
  const [markingPayrollProcessed, setMarkingPayrollProcessed] = useState(false);
  const [revertReimburseOpen, setRevertReimburseOpen] = useState(false);
  const [revertingReimbursement, setRevertingReimbursement] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!reportId) return;
    try {
      setLoading(true);
      const res = await getExpenseReport(reportId);
      setReport(res.data);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load report";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    listExpenseCategories()
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  const toggleSort = useCallback((key: ExpenseSortKey) => {
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }, []);

  // Sort the line items client-side. Numeric columns (date/amount/receipt)
  // subtract; text columns use locale compare for accent-aware A→Z. Amount
  // normalizes to THB where a converted value exists so mixed-currency rows
  // sort by real value, not raw figures across currencies.
  const sortedExpenses = useMemo(() => {
    const rows = report?.expenses ?? [];
    if (!sort) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    const value = (e: Expense): number | string => {
      switch (sort.key) {
        case "date":
          return new Date(e.date).getTime();
        case "description":
          return (e.description ?? "").toLowerCase();
        case "category":
          return (e.category?.name ?? "").toLowerCase();
        case "amount":
          return e.fxConvertedThb != null
            ? Number(e.fxConvertedThb)
            : Number(e.amount);
        case "receipt":
          return e.receiptUrl ? 1 : 0;
      }
    };
    return [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [report?.expenses, sort]);

  if (loading) {
    return (
      <div
        className={`
          text-muted-foreground flex items-center justify-center py-24
        `}
      >
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading report…
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <p className="text-muted-foreground text-sm">Report not found.</p>
        <Button variant="outline" onClick={() => router.push(backHref)}>
          <ArrowLeft className="mr-1 size-4" /> {backLabel}
        </Button>
      </div>
    );
  }

  const isOwner = report.employee.id === user?.id;
  // Trust the server-computed flag when present — it accounts for the
  // submitter's reportingTo (manager fallback) and snapshot-chain
  // assignments that aren't visible from the client. Fall back to the
  // perm-only check for older API responses without the flag.
  const canApprove =
    report.canApprove ??
    (hasAnyPermission("expense:approve", "expense:hr-approve") &&
      report.status === "submitted" &&
      !isOwner);
  // Reimburse is reachable from `approved` (fast path) OR from
  // `payroll_processed` (after the intermediate flip below).
  const canReimburse =
    hasAnyPermission("expense:hr-approve") &&
    (report.status === "approved" || report.status === "payroll_processed");
  // Optional intermediate step — surfaces only while the report sits
  // in `approved`. Once it's been marked, the button disappears and
  // only Mark reimbursed remains.
  const canMarkPayrollProcessed =
    hasAnyPermission("expense:hr-approve") && report.status === "approved";
  // Same permission gate as the forward action. Only finance HR who
  // can flip the report `approved → reimbursed` is allowed to roll it
  // back. Surfaces in the UI once the report sits in `reimbursed`.
  const canRevertReimbursement =
    hasAnyPermission("expense:hr-approve") && report.status === "reimbursed";
  const isEditable =
    isOwner && (report.status === "draft" || report.status === "rejected");
  const canSubmit = isEditable && report.expenses.length > 0;

  // Currency for a NEW line item — the native code colleagues are
  // already claiming in. Never label a report total with it: the total
  // is converted, `totalCurrency` says what to.
  const defaultCurrency = report.expenses[0]?.currency ?? "THB";
  const totalCurrency = reportTotalCurrency(report);

  async function handleSubmit() {
    try {
      setSubmitting(true);
      await submitExpenseReport(reportId);
      toast.success("Report submitted to your line manager");
      await fetchReport();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Submit failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove() {
    try {
      setApproving(true);
      // Empty input -> approve the full submitted total. Any non-empty
      // value is parsed and capped by the server against the report's
      // submitted total (it returns a 400 if exceeded).
      const trimmed = approveAmountInput.trim();
      const parsed = trimmed === "" ? undefined : Number(trimmed);
      if (parsed !== undefined && (!Number.isFinite(parsed) || parsed <= 0)) {
        toast.error("Approved amount must be a positive number");
        setApproving(false);
        return;
      }
      await approveExpenseReport(reportId, {
        ...(parsed !== undefined ? { approvedAmount: parsed } : {}),
        ...(approveNotes.trim() ? { notes: approveNotes.trim() } : {}),
      });
      toast.success(
        parsed !== undefined
          ? `Report approved at ${parsed.toLocaleString()}`
          : "Report approved",
      );
      setApproveOpen(false);
      setApproveAmountInput("");
      setApproveNotes("");
      await fetchReport();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Approve failed";
      toast.error(msg);
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error("Reason is required");
      return;
    }
    try {
      setRejecting(true);
      await rejectExpenseReport(reportId, rejectReason.trim());
      toast.success("Report rejected — employee notified");
      setRejectOpen(false);
      setRejectReason("");
      await fetchReport();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Reject failed";
      toast.error(msg);
    } finally {
      setRejecting(false);
    }
  }

  async function handleReimburse() {
    try {
      setReimbursing(true);
      await reimburseExpenseReport(reportId);
      toast.success("Report marked reimbursed");
      await fetchReport();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Reimburse failed";
      toast.error(msg);
    } finally {
      setReimbursing(false);
    }
  }

  async function handleMarkPayrollProcessed() {
    try {
      setMarkingPayrollProcessed(true);
      await markExpenseReportPayrollProcessed(reportId);
      toast.success("Report marked payroll processed");
      await fetchReport();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Mark payroll processed failed";
      toast.error(msg);
    } finally {
      setMarkingPayrollProcessed(false);
    }
  }

  async function handleRevertReimbursement() {
    try {
      setRevertingReimbursement(true);
      await revertExpenseReportReimbursement(reportId);
      toast.success("Reimbursement reverted — report back to approved");
      setRevertReimburseOpen(false);
      await fetchReport();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Revert failed";
      toast.error(msg);
    } finally {
      setRevertingReimbursement(false);
    }
  }

  async function handleRemoveExpense() {
    if (!removeTarget) return;
    try {
      setRemoving(true);
      await removeExpenseFromReport(reportId, removeTarget.id);
      toast.success("Expense removed");
      setRemoveTarget(null);
      await fetchReport();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Remove failed";
      toast.error(msg);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={report.title}
        subtitle={`${submitterDisplayName(report)} · Period ${report.period} · ${report.entity.name}`}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(backHref)}>
            <ArrowLeft className="mr-1 size-3.5" />
            {backLabel}
          </Button>
          <Badge variant={STATUS_VARIANT[report.status] ?? "grey"}>
            {EXPENSE_STATUS_LABELS[report.status] ?? report.status}
          </Badge>
        </div>
      </PageHeader>

      {report.rejectReason ? (
        <div
          className={`
            rounded-md border border-amber-300/50 bg-amber-500/10 p-3 text-xs
          `}
        >
          <span className="font-semibold text-amber-700">
            Rejection reason:{" "}
          </span>
          {report.rejectReason}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {isEditable && (
          <Button
            onClick={() => {
              setEditingExpense(null);
              setRowFormOpen(true);
            }}
          >
            <Plus className="mr-1 size-3.5" /> Add expense
          </Button>
        )}
        {canSubmit && (
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={submitting || !report.converted}
            title={
              report.converted
                ? undefined
                : `Add a ${report.missingRates.join(", ")} → THB exchange rate in Accounting → Exchange Rates before submitting`
            }
          >
            {submitting ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <Send className="mr-1 size-3.5" />
            )}
            Submit for approval
          </Button>
        )}
        {canApprove && (
          <>
            <Button
              variant="default"
              onClick={() => {
                // Pre-fill the amount field with the submitted total so
                // the approver can either accept it as-is or adjust.
                setApproveAmountInput(String(report.totalAmount));
                setApproveNotes("");
                setApproveOpen(true);
              }}
              disabled={approving}
            >
              {approving ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : (
                <Check className="mr-1 size-3.5" />
              )}
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => setRejectOpen(true)}
              disabled={rejecting}
            >
              <X className="mr-1 size-3.5" /> Reject
            </Button>
          </>
        )}
        {canMarkPayrollProcessed && (
          <Button
            variant="outline"
            onClick={handleMarkPayrollProcessed}
            disabled={markingPayrollProcessed}
          >
            {markingPayrollProcessed ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : null}
            Mark payroll processed
          </Button>
        )}
        {canReimburse && (
          <Button
            variant="outline"
            onClick={handleReimburse}
            disabled={reimbursing}
          >
            {reimbursing ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : null}
            Mark reimbursed
          </Button>
        )}
        {canRevertReimbursement && (
          <Button
            variant="outline"
            onClick={() => setRevertReimburseOpen(true)}
            disabled={revertingReimbursement}
          >
            {revertingReimbursement ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <Undo2 className="mr-1 size-3.5" />
            )}
            Revert reimbursement
          </Button>
        )}
      </div>

      <div
        className={`
          grid gap-3
          sm:grid-cols-3
        `}
      >
        <SummaryStat label="Expenses" value={String(report.expenses.length)} />
        <SummaryStat
          label={report.approvedTotal !== null ? "Submitted" : "Total"}
          value={
            report.converted
              ? formatAmount(report.totalAmount, totalCurrency)
              : `— (${report.missingRates.join(", ")}→THB rate missing)`
          }
        />
        {report.approvedTotal !== null ? (
          <SummaryStat
            label="Approved"
            value={formatAmount(report.approvedTotal, totalCurrency)}
          />
        ) : (
          <SummaryStat
            label="Submitted"
            value={
              report.submittedAt ? formatDate(report.submittedAt) : "Not yet"
            }
          />
        )}
      </div>
      {report.approvedTotal !== null &&
        report.approvedTotal !== report.totalAmount && (
          <p className="text-muted-foreground -mt-1 text-xs">
            Finance-adjusted on approval — payroll will reimburse{" "}
            <strong>{formatAmount(report.approvedTotal, totalCurrency)}</strong>
            , not the submitted{" "}
            {formatAmount(report.totalAmount, totalCurrency)}.
          </p>
        )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[700px] text-[13px]">
          <thead className="bg-muted/40 text-left">
            <tr>
              <SortHeader
                label="Date"
                sortKey="date"
                sort={sort}
                onSort={toggleSort}
              />
              <SortHeader
                label="Description"
                sortKey="description"
                sort={sort}
                onSort={toggleSort}
              />
              <SortHeader
                label="Category"
                sortKey="category"
                sort={sort}
                onSort={toggleSort}
              />
              <SortHeader
                label="Amount"
                sortKey="amount"
                sort={sort}
                onSort={toggleSort}
                align="right"
              />
              <SortHeader
                label="Receipt"
                sortKey="receipt"
                sort={sort}
                onSort={toggleSort}
              />
              {isEditable && <th className="px-3 py-2 font-medium" />}
            </tr>
          </thead>
          <tbody>
            {sortedExpenses.length === 0 ? (
              <tr>
                <td
                  colSpan={isEditable ? 6 : 5}
                  className="text-muted-foreground px-3 py-8 text-center"
                >
                  {isEditable
                    ? "No expenses yet — click Add expense to start."
                    : "No expenses in this report."}
                </td>
              </tr>
            ) : (
              sortedExpenses.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2 tabular-nums">
                    {formatDate(e.date)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{e.description}</div>
                    {e.notes ? (
                      <div className="text-muted-foreground text-[11px]">
                        {e.notes}
                      </div>
                    ) : null}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {e.category?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatAmount(Number(e.amount), e.currency)}
                    {e.currency?.toUpperCase() !== "THB" &&
                      (e.fxRate != null && e.fxConvertedThb != null ? (
                        <div
                          className={`
                            text-muted-foreground mt-0.5 text-[11px] font-normal
                          `}
                        >
                          <div>
                            1 {e.currency} ≈ {formatRate(e.fxRate)} THB
                          </div>
                          <div>≈ {formatCurrency(e.fxConvertedThb, "THB")}</div>
                        </div>
                      ) : (
                        <div
                          className={`text-muted-foreground mt-0.5 text-[11px]`}
                        >
                          — THB rate missing
                        </div>
                      ))}
                  </td>
                  <td className="px-3 py-2">
                    {e.receiptUrl ? (
                      <ReceiptViewLink reportId={reportId} expenseId={e.id} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  {isEditable && (
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingExpense(e);
                          setRowFormOpen(true);
                        }}
                      >
                        <Edit className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRemoveTarget(e)}
                      >
                        <Trash2 className="text-destructive size-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ExpenseRowFormDialog
        open={rowFormOpen}
        onOpenChange={setRowFormOpen}
        onSaved={fetchReport}
        reportId={reportId}
        defaultCurrency={defaultCurrency}
        categories={categories}
        expense={editingExpense}
      />

      <AlertDialog
        open={revertReimburseOpen}
        onOpenChange={(next) => {
          if (!revertingReimbursement) setRevertReimburseOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert reimbursement?</AlertDialogTitle>
            <AlertDialogDescription>
              This moves the report back from <strong>Reimbursed</strong> to{" "}
              <strong>Approved</strong> and clears the reimbursement date. Use
              this only if the payment did not clear or the wrong report was
              marked. The employee is not notified — let them know out-of-band.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revertingReimbursement}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevertReimbursement}
              disabled={revertingReimbursement}
            >
              {revertingReimbursement && (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              )}
              Revert reimbursement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(next) => {
          if (!removing && !next) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove expense</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &ldquo;{removeTarget?.description}&rdquo; from this report?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleRemoveExpense}
              disabled={removing}
            >
              {removing && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={approveOpen}
        onOpenChange={(next) => {
          if (!approving) setApproveOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve report</DialogTitle>
            <DialogDescription>
              Approve the full submitted amount, or enter a lower
              finance-adjusted total. The adjusted amount is what payroll and
              the reimbursement notice will use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="approve-amount" className="text-sm">
                Approved amount ({totalCurrency})
              </Label>
              <Input
                id="approve-amount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={approveAmountInput}
                onChange={(e) => setApproveAmountInput(e.target.value)}
                disabled={approving}
                placeholder={String(report.totalAmount)}
              />
              <p className="text-muted-foreground text-xs">
                Submitted total:{" "}
                {formatCurrency(report.totalAmount, totalCurrency)}. Leave at
                the submitted value to approve in full, or lower it to apply a
                haircut.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="approve-notes" className="text-sm">
                Notes (optional)
              </Label>
              <Textarea
                id="approve-notes"
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                placeholder="e.g. Approved up to the per-diem cap"
                rows={2}
                disabled={approving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveOpen(false)}
              disabled={approving}
            >
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={approving}>
              {approving && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Confirm approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectOpen}
        onOpenChange={(next) => {
          if (!rejecting) setRejectOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject report</DialogTitle>
            <DialogDescription>
              Tell the employee what needs to change before they can re-submit.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Missing receipt for the taxi line, please re-upload."
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={rejecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting}
            >
              {rejecting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-md border p-3">
      <div className="text-muted-foreground text-[11px] tracking-wide uppercase">
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: ExpenseSortKey;
  sort: ExpenseSort | null;
  onSort: (key: ExpenseSortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={cn("px-3 py-2 font-medium", align === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
        className={cn(
          `
            inline-flex items-center gap-1 transition-opacity
            hover:opacity-70
          `,
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon className={cn("size-3", active ? "opacity-90" : "opacity-30")} />
      </button>
    </th>
  );
}

/**
 * Resolves a fresh Supabase signed URL on click rather than relying on
 * whatever URL the server emitted when the page first loaded. Stops
 * the JWT-expired "exp claim timestamp check failed" page from
 * appearing when an admin opens the report long after the initial
 * fetch.
 */
function ReceiptViewLink({
  reportId,
  expenseId,
}: {
  reportId: string;
  expenseId: string;
}) {
  const [loading, setLoading] = useState(false);

  function open(e: React.MouseEvent<HTMLButtonElement>) {
    if (loading) return;
    // Open the tab synchronously so we keep the user-gesture and
    // Chrome's popup blocker stays out of the way. Once the signed
    // URL comes back we redirect that tab — or close it on error.
    // The previous implementation `await`-ed first then called
    // `window.open`, which Chrome treats as a blocked popup → Pat
    // saw a blank tab while Vivek (owner) got the PDF.
    //
    // We deliberately omit `noopener`/`noreferrer` here — both null
    // the returned handle so we can't redirect the popup. Acceptable
    // because the destination is a short-lived (60 s) Supabase
    // signed URL on a trusted domain.
    const popup = window.open("about:blank", "_blank");
    setLoading(true);
    getExpenseReceiptUrl(reportId, expenseId)
      .then((res) => {
        if (popup && !popup.closed) {
          popup.location.href = res.data.url;
        } else {
          // Popup was blocked anyway — fall back to same-tab navigation
          // so the user still gets the file.
          window.location.href = res.data.url;
        }
      })
      .catch((err) => {
        popup?.close();
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not load receipt";
        toast.error(msg);
      })
      .finally(() => {
        setLoading(false);
      });
    e.preventDefault();
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className={`
        text-blue-600
        hover:underline
        disabled:opacity-60
      `}
    >
      {loading ? "Loading…" : "View"}
    </button>
  );
}
