"use client";

import { AlertCircle, GitFork, Pencil, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PayslipEditDialog } from "@/components/payroll/payslip-edit-dialog";
import { Badge } from "@/components/shared/badge";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { TableCell, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import {
  getPayrollRun,
  type PayrollRunDetail,
  type Payslip,
  recalculatePayrollRunTotals,
} from "@/services/payroll.service";
import {
  listPayrollApprovalSteps,
  type PayrollApprovalStep,
} from "@/services/payroll-approval.service";

function formatCurrency(value: string | number): string {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Read a numeric bucket out of the JSON map case-insensitively. Legacy
 * imports stored "Meal" / "meal" / "MEAL" interchangeably, so we
 * normalise the lookup so the new column-per-bucket layout doesn't
 * silently render "—" for historic rows.
 */
function pickBucket(
  record: Record<string, number> | null,
  key: string,
): number | null {
  if (!record) return null;
  const wantedLower = key.toLowerCase();
  for (const [k, v] of Object.entries(record)) {
    if (k.toLowerCase() === wantedLower) {
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    }
  }
  return null;
}

function NumberCell({ value }: { value: number | null }) {
  if (value == null || value === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span className="tabular-nums">{formatCurrency(value)}</span>;
}

/**
 * Per-currency total payout cell. The row's currency picks which one
 * of the three columns lights up — the others render a soft dash so
 * the layout still matches the source spreadsheet.
 */
function PayoutCell({
  value,
  match,
}: {
  value: string | number;
  match: boolean;
}) {
  if (!match) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="font-medium tabular-nums">{formatCurrency(value)}</span>
  );
}

/**
 * Entity-currency payout cell. Renders every row in the run's entity
 * currency, FX-converting off-currency slips via the rate the server
 * attached. Column sum equals the headline Total Net. Missing rates
 * show "—" with a tooltip so HR can spot the gap.
 */
function EntityCurrencyPayoutCell({ payslip }: { payslip: Payslip }) {
  const value = payslip.netPayInEntityCurrency;
  if (value == null) {
    return (
      <span
        className="text-muted-foreground"
        title={
          payslip.fxSource === "missing"
            ? `Missing FX rate for ${payslip.currency} — not included in totals`
            : undefined
        }
      >
        —
      </span>
    );
  }
  const converted = payslip.fxSource !== "identity";
  return (
    <span
      className={`
        tabular-nums
        ${converted ? "italic" : "font-medium"}
      `}
      title={
        converted && payslip.fxRate
          ? `Converted from ${formatCurrency(payslip.netPay)} ${payslip.currency} @ ${payslip.fxRate.toFixed(4)}`
          : undefined
      }
    >
      {formatCurrency(value)}
    </span>
  );
}

interface PayrollRunDetailSheetProps {
  runId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Gate the edit-payslip flow. Plain readers see read-only cells. */
  canEdit?: boolean;
  /** Notify parent (e.g. payroll list) that totals changed. */
  onPayslipUpdated?: () => void;
  /** Gate the "Recalculate totals" button (payroll:create). */
  canRecalculate?: boolean;
}

export function PayrollRunDetailSheet({
  runId,
  open,
  onOpenChange,
  canEdit = false,
  onPayslipUpdated,
  canRecalculate = false,
}: PayrollRunDetailSheetProps) {
  const [detail, setDetail] = useState<PayrollRunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [recalcBusy, setRecalcBusy] = useState(false);
  // Approval chain preview — read-only snapshot of the configured
  // chain so HR / leadership see who has to sign off before the run
  // moves to `approved`. Falls back to empty when no chain is set up
  // (legacy behaviour: anyone with `payroll:approve` can sign off).
  const [chainSteps, setChainSteps] = useState<PayrollApprovalStep[]>([]);

  const fetchDetail = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await getPayrollRun(id);
      setDetail(result.data);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load payroll run details";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && runId) {
      void fetchDetail(runId);
      // Best-effort chain fetch — non-admin readers may 403 on the list
      // endpoint (`payroll:hr-admin` / `payroll:approve` gate), which
      // is fine: an empty chain just hides the preview section.
      listPayrollApprovalSteps()
        .then((res) => setChainSteps(res.data.filter((s) => s.isActive)))
        .catch(() => setChainSteps([]));
    }
    if (!open) {
      setDetail(null);
      setError(null);
      setChainSteps([]);
    }
  }, [open, runId, fetchDetail]);

  const handleEditClick = useCallback(
    (p: Payslip) => {
      if (!canEdit) return;
      setEditingPayslip(p);
      setEditOpen(true);
    },
    [canEdit],
  );

  /**
   * After a successful payslip edit the API returns the updated row.
   * Patch it into the in-memory detail so the user sees their change
   * without a full refetch, then re-fetch the run so the summary card
   * (totalGross / totalTax / totalNet) reflects the recomputed totals.
   */
  const handlePayslipSaved = useCallback(
    (next: Payslip) => {
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              payslips: prev.payslips.map((p) =>
                p.id === next.id ? { ...p, ...next } : p,
              ),
            }
          : prev,
      );
      if (runId) void fetchDetail(runId);
      onPayslipUpdated?.();
    },
    [runId, fetchDetail, onPayslipUpdated],
  );

  const isDraft = detail?.status === "draft";
  const canEditPayslip = canEdit && isDraft;

  const handleRecalculate = useCallback(async () => {
    if (!runId) return;
    try {
      setRecalcBusy(true);
      const res = await recalculatePayrollRunTotals(runId);
      if (res.data.missingFxFor.length > 0) {
        toast.warning(
          `Totals refreshed. Missing FX rate for ${res.data.missingFxFor.join(", ")} — those slips are not included in the headline totals.`,
        );
      } else {
        toast.success("Totals refreshed");
      }
      await fetchDetail(runId);
      onPayslipUpdated?.();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to refresh totals";
      toast.error(msg);
    } finally {
      setRecalcBusy(false);
    }
  }, [runId, fetchDetail, onPayslipUpdated]);

  const payslipColumns = useMemo(
    () => [
      {
        key: "employee",
        header: "Employee Name",
        render: (p: Payslip) => (
          <div className="flex flex-col">
            <span className="font-medium">{p.employee.name}</span>
            {p.employee.email && (
              <span className="text-muted-foreground text-[11px]">
                {p.employee.email}
              </span>
            )}
          </div>
        ),
        className: "min-w-[180px] align-top",
      },
      {
        key: "position",
        header: "Position",
        render: (p: Payslip) => {
          // Prefer the snapshot — that's the value HR actually typed
          // into the xlsx for this run. The live `users.jobTitle` is a
          // fallback for older runs imported before snapshots existed.
          const value = p.positionSnapshot ?? p.employee.jobTitle ?? null;
          return value ? (
            <span className="text-xs">{value}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
        className: "align-top",
      },
      {
        key: "department",
        header: "Department",
        render: (p: Payslip) => {
          const value = p.departmentSnapshot ?? p.employee.department ?? null;
          return value ? (
            <span
              className={`
                text-muted-foreground text-[11px] tracking-wide uppercase
              `}
            >
              {value}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
        className: "align-top",
      },
      {
        key: "startDate",
        header: "Start Date",
        render: (p: Payslip) => {
          // Snapshot is the verbatim xlsx cell (e.g. "1-Aug-20" or
          // "2024-08-01"); don't re-parse — render as typed.
          if (p.startDateSnapshot) {
            return (
              <span className="text-xs tabular-nums">
                {p.startDateSnapshot}
              </span>
            );
          }
          if (p.employee.startDate) {
            return (
              <span className="text-xs tabular-nums">
                {new Date(p.employee.startDate).toLocaleDateString()}
              </span>
            );
          }
          return <span className="text-muted-foreground">—</span>;
        },
        className: "align-top whitespace-nowrap",
      },
      {
        key: "baseSalary",
        header: "Salary (fiat)",
        render: (p: Payslip) => (
          <span className="tabular-nums">{formatCurrency(p.baseSalary)}</span>
        ),
        className: "text-right align-top",
      },
      {
        key: "currency",
        header: "Currency",
        render: (p: Payslip) => (
          <span className="text-muted-foreground text-xs uppercase">
            {p.currency}
          </span>
        ),
        className: "align-top",
      },
      // Allowance breakdown — one column per template bucket so the
      // sheet mirrors HR's xlsx exactly. `pickBucket` reads the JSON
      // map case-insensitively because legacy imports stored keys with
      // different casings (e.g. "Meal" vs "meal").
      {
        key: "alw_meal",
        header: "Meal",
        render: (p: Payslip) => (
          <NumberCell value={pickBucket(p.allowances, "meal")} />
        ),
        className: "text-right align-top",
      },
      {
        key: "alw_transport",
        header: "Transportation",
        render: (p: Payslip) => (
          <NumberCell value={pickBucket(p.allowances, "transportation")} />
        ),
        className: "text-right align-top",
      },
      {
        key: "alw_telephone",
        header: "Telephone",
        render: (p: Payslip) => (
          <NumberCell value={pickBucket(p.allowances, "telephone")} />
        ),
        className: "text-right align-top",
      },
      {
        key: "alw_wifi",
        header: "Wifi (India)",
        render: (p: Payslip) => (
          <NumberCell value={pickBucket(p.allowances, "wifi")} />
        ),
        className: "text-right align-top",
      },
      {
        key: "alw_other",
        header: "Other Income",
        render: (p: Payslip) => (
          <NumberCell value={pickBucket(p.allowances, "otherIncome")} />
        ),
        className: "text-right align-top",
      },
      {
        key: "alw_reimb",
        header: "Reimbursement",
        render: (p: Payslip) => (
          <NumberCell value={pickBucket(p.allowances, "reimbursement")} />
        ),
        className: "text-right align-top",
      },
      // Deduction buckets.
      {
        key: "ded_tax",
        header: "Tax",
        render: (p: Payslip) => (
          <NumberCell value={pickBucket(p.deductions, "tax")} />
        ),
        className: "text-right align-top",
      },
      {
        key: "ded_ssf",
        header: "SSF",
        render: (p: Payslip) => (
          <NumberCell value={pickBucket(p.deductions, "ssf")} />
        ),
        className: "text-right align-top",
      },
      {
        key: "ded_other",
        header: "Other Deduction",
        render: (p: Payslip) => (
          <NumberCell value={pickBucket(p.deductions, "otherDeduction")} />
        ),
        className: "text-right align-top",
      },
      // Per-currency total payout. Only the column matching the row's
      // currency lights up — the others render "—" so the table still
      // mirrors the spreadsheet layout where every cell is laid out.
      {
        key: "total_inr",
        header: "Total Payout INR",
        render: (p: Payslip) => (
          <PayoutCell value={p.netPay} match={p.currency === "INR"} />
        ),
        className: "text-right align-top",
      },
      {
        key: "total_usd",
        header: "Total Payout USD",
        render: (p: Payslip) => (
          <PayoutCell value={p.netPay} match={p.currency === "USD"} />
        ),
        className: "text-right align-top",
      },
      {
        key: "total_thb",
        header: `Total Net (${detail?.entityCurrency ?? detail?.entity?.currency ?? "THB"} equiv)`,
        render: (p: Payslip) => <EntityCurrencyPayoutCell payslip={p} />,
        className: "text-right align-top",
      },
      ...(canEditPayslip
        ? [
            {
              key: "actions",
              mobileRole: "actions" as const,
              header: "",
              className: "w-[60px] align-top",
              render: (p: Payslip) => (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditClick(p);
                  }}
                  aria-label="Edit payslip"
                >
                  <Pencil className="size-3.5" />
                </Button>
              ),
            },
          ]
        : []),
    ],
    [
      canEditPayslip,
      handleEditClick,
      detail?.entityCurrency,
      detail?.entity?.currency,
    ],
  );

  // Column-sum footer for the payslip table. Mirrors the totals row HR
  // adds at the bottom of the import xlsx so the on-screen layout
  // matches the source spreadsheet without HR cross-checking three
  // numbers in their head. `Total Net (THB equiv)` sums the FX-
  // converted values so it stays in sync with the headline.
  const payslipFooter = useMemo(() => {
    if (!detail || detail.payslips.length === 0) return null;
    let totalInr = 0;
    let totalUsd = 0;
    let totalThb = 0;
    let totalEntity = 0;
    for (const p of detail.payslips) {
      const net = Number(p.netPay ?? 0);
      if (p.currency === "INR") totalInr += net;
      else if (p.currency === "USD") totalUsd += net;
      else if (p.currency === "THB") totalThb += net;
      if (p.netPayInEntityCurrency != null) {
        totalEntity += Number(p.netPayInEntityCurrency);
      }
    }
    const entityLabel =
      detail.entityCurrency ?? detail.entity?.currency ?? "THB";
    return (
      <TableRow
        className={`
          border-border bg-surface-secondary/50 border-t-2
          hover:bg-surface-secondary/50
        `}
      >
        <TableCell
          colSpan={4}
          className={`
            text-muted-foreground px-3.5 py-2.5 text-right text-[10px] font-bold
            tracking-[0.12em] uppercase
          `}
        >
          Totals
        </TableCell>
        <TableCell className="px-3.5 py-2.5" />
        <TableCell className="px-3.5 py-2.5" />
        <TableCell className="px-3.5 py-2.5" colSpan={9} />
        <TableCell
          className={`px-3.5 py-2.5 text-right font-semibold tabular-nums`}
        >
          {totalInr > 0 ? (
            formatCurrency(totalInr)
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell
          className={`px-3.5 py-2.5 text-right font-semibold tabular-nums`}
        >
          {totalUsd > 0 ? (
            formatCurrency(totalUsd)
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell
          className={`px-3.5 py-2.5 text-right font-semibold tabular-nums`}
          title={`THB-native: ${formatCurrency(totalThb)}`}
        >
          {formatCurrency(totalEntity)}
          <span className="text-muted-foreground ml-1 text-[10px] uppercase">
            {entityLabel}
          </span>
        </TableCell>
        {canEditPayslip && <TableCell className="px-3.5 py-2.5" />}
      </TableRow>
    );
  }, [detail, canEditPayslip]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className={`
            flex w-full flex-col overflow-hidden
            sm:max-w-2xl!
            lg:max-w-5xl!
            xl:max-w-6xl!
          `}
        >
          <SheetHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <SheetTitle>Payroll Run Details</SheetTitle>
                <SheetDescription>
                  {detail
                    ? `${detail.entity.name} — ${detail.period}`
                    : "Loading run details…"}
                </SheetDescription>
              </div>
              {detail && canRecalculate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleRecalculate()}
                  disabled={recalcBusy}
                  title="Re-sum totals across all currencies using the latest FX rates"
                >
                  <RefreshCw
                    className={`
                      size-3.5
                      ${recalcBusy ? "animate-spin" : ""}
                    `}
                  />
                  Recalculate totals
                </Button>
              )}
            </div>
          </SheetHeader>

          {loading && (
            <div className="flex flex-1 items-center justify-center py-12">
              <span
                className={`
                  text-muted-foreground inline-flex items-center gap-2 text-sm
                `}
              >
                <Spinner className="size-4" />
                Loading…
              </span>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-1 items-center justify-center py-12">
              <span
                className={`
                  text-destructive inline-flex items-center gap-2 text-sm
                `}
              >
                <AlertCircle className="size-4" />
                {error}
              </span>
            </div>
          )}

          {detail && !loading && (
            <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
              <div
                className={`
                  border-border bg-surface-secondary/50 grid grid-cols-2 gap-x-6
                  gap-y-3 rounded-lg border p-4 text-sm
                  sm:grid-cols-4
                `}
              >
                <SummaryCell label="Entity" value={detail.entity.name} />
                <SummaryCell label="Period" value={detail.period} tabular />
                <div>
                  <SummaryLabel>Status</SummaryLabel>
                  <div className="mt-1">
                    <Badge status={detail.status}>{detail.status}</Badge>
                  </div>
                </div>
                <SummaryCell label="Run By" value={detail.runner.name} />
                <SummaryCell
                  label={`Total Tax${detail.entity.currency ? ` (${detail.entity.currency})` : ""}`}
                  value={formatCurrency(detail.totalTax)}
                  tabular
                />
                <SummaryCell
                  label={`Total Net${detail.entity.currency ? ` (${detail.entity.currency})` : ""}`}
                  value={formatCurrency(detail.totalNet)}
                  tabular
                  bold
                />
                <SummaryCell
                  label="Payslips"
                  value={detail.payslips.length.toString()}
                  tabular
                />
              </div>

              {detail.missingFxFor && detail.missingFxFor.length > 0 && (
                <div
                  className={`
                    border-destructive/40 bg-destructive/10 text-destructive
                    flex items-start gap-2 rounded-lg border p-3 text-xs
                  `}
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">
                      Headline total excludes {detail.missingFxFor.join(", ")}{" "}
                      payslips — no exchange rate on file.
                    </p>
                    <p className="text-destructive/80 mt-0.5">
                      Add a rate via Admin → Exchange rates (or any USD-base
                      rate works through triangulation), then reopen this run or
                      click Recalculate totals.
                    </p>
                  </div>
                </div>
              )}

              {chainSteps.length > 0 && (
                <section
                  className={`
                    border-border bg-surface-secondary/30 flex flex-col gap-2
                    rounded-lg border p-3
                  `}
                >
                  <div className="flex items-center justify-between">
                    <SummaryLabel>Approval chain</SummaryLabel>
                    <Button
                      asChild
                      size="xs"
                      variant="ghost"
                      className="h-auto px-1.5 py-0.5 text-[11px]"
                    >
                      <Link href="/payroll/approval">
                        <GitFork className="mr-1 size-3" />
                        Manage
                      </Link>
                    </Button>
                  </div>
                  <ol className="flex flex-col gap-1.5">
                    {chainSteps.map((step) => (
                      <li
                        key={step.id}
                        className={`
                          border-border/60 bg-background flex items-center
                          gap-2.5 rounded-md border px-2.5 py-1.5 text-xs
                        `}
                      >
                        <span
                          className={`
                            bg-muted text-foreground flex size-5 shrink-0
                            items-center justify-center rounded-full text-[10px]
                            font-semibold tabular-nums
                          `}
                        >
                          {step.order}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground truncate font-medium">
                            {step.name}
                          </p>
                          <p
                            className={`
                              text-muted-foreground truncate text-[11px]
                            `}
                          >
                            {step.approverUser
                              ? `${step.approverUser.name} · ${step.approverUser.email}`
                              : "Approver removed"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* Per-currency rollup. Surfaced only when the run mixes
                 currencies (e.g. THB entity paying USD/INR contractors)
                 so the headline THB-only totals stay readable but HR
                 still sees the off-currency tallies. */}
              {detail.currencyTotals &&
                Object.keys(detail.currencyTotals).length > 1 && (
                  <div
                    className={`
                      border-border bg-surface-secondary/30 flex flex-col gap-2
                      rounded-lg border p-3 text-sm
                    `}
                  >
                    <SummaryLabel>By currency</SummaryLabel>
                    <div
                      className={`
                        grid grid-cols-1 gap-x-6 gap-y-1
                        sm:grid-cols-2
                      `}
                    >
                      {Object.entries(detail.currencyTotals)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([ccy, t]) => (
                          <div
                            key={ccy}
                            className={`
                              flex items-center justify-between gap-3 text-xs
                              tabular-nums
                            `}
                          >
                            <span
                              className={`
                                text-foreground font-mono text-[11px] uppercase
                              `}
                            >
                              {ccy}
                              <span className="text-muted-foreground ml-1">
                                · {t.count} {t.count === 1 ? "slip" : "slips"}
                              </span>
                            </span>
                            <span className="text-foreground">
                              gross{" "}
                              <span className="font-medium">
                                {formatCurrency(t.gross)}
                              </span>{" "}
                              · tax{" "}
                              <span className="font-medium">
                                {formatCurrency(t.tax)}
                              </span>{" "}
                              · net{" "}
                              <span className="font-semibold">
                                {formatCurrency(t.net)}
                              </span>
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              {detail.notes && (
                <div
                  className={`
                    border-border bg-surface-secondary/30 rounded-lg border p-3
                    text-sm
                  `}
                >
                  <SummaryLabel>Notes</SummaryLabel>
                  <p
                    className={`
                      text-foreground-secondary mt-1 whitespace-pre-wrap
                    `}
                  >
                    {detail.notes}
                  </p>
                </div>
              )}

              {canEdit && !isDraft && (
                <p
                  className={`
                    text-muted-foreground border-border/60 rounded-md border
                    border-dashed p-2 text-[11px]
                  `}
                >
                  This run is {detail.status} — payslips are read-only. Revert
                  to draft before editing.
                </p>
              )}

              {/*
                Scroll context lives directly on the DataTable's outer
                wrapper. Passing `overflow-auto` overrides DataTable's
                default `overflow-hidden` via tailwind-merge, while
                `min-h-0 flex-1` lets it shrink within the flex parent so
                the table region scrolls independently of the summary
                card. This is what finally got the 52-row run to scroll
                on production after #337–#340.
              */}
              <DataTable
                // A payroll run is read DOWN its columns -- is anyone's tax
                // wrong, does the run foot -- and base + allowances -
                // deductions = total only means anything with the parts
                // side by side. Measured at 390px: as cards, 0 of 12
                // figures are visible without expanding, an expanded card
                // is 645px of 19 labelled rows, and the run totals row is
                // not rendered on the card path AT ALL, so it cannot be
                // reached at any depth. As a table: 12/12 figures, totals
                // present, 2781px scrolling inside a 356px container with
                // zero page overflow and a sticky header that stays
                // aligned with its column.
                mobileMode="table"
                columns={payslipColumns}
                data={detail.payslips}
                title="Payslips"
                emptyMessage="No payslips in this run"
                onRowClick={canEditPayslip ? handleEditClick : undefined}
                footer={payslipFooter}
                className={`
                  [&_thead_tr]:bg-surface-secondary
                  min-h-0 flex-1 overflow-auto
                  [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10
                `}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <PayslipEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        runId={runId ?? ""}
        payslip={editingPayslip}
        onSaved={handlePayslipSaved}
      />
    </>
  );
}

function SummaryLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className={`
        text-muted-foreground text-[10px] font-bold tracking-wider uppercase
      `}
    >
      {children}
    </p>
  );
}

function SummaryCell({
  label,
  value,
  tabular = false,
  bold = false,
}: {
  label: string;
  value: string;
  tabular?: boolean;
  bold?: boolean;
}) {
  return (
    <div>
      <SummaryLabel>{label}</SummaryLabel>
      <p
        className={`
          text-foreground mt-0.5
          ${bold ? "font-medium" : ""}
          ${tabular ? "tabular-nums" : ""}
        `}
      >
        {value}
      </p>
    </div>
  );
}
