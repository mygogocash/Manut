"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { formatCurrency } from "@/components/accounting/accounting-utils";
import { Badge } from "@/components/shared/badge";
import { DataTable } from "@/components/shared/data-table";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import {
  createEntityTaxRate,
  type DeferredTaxExclusionReason,
  deleteEntityTaxRate,
  type EntityTaxRate,
  type FixedAssetDeferredTaxExclusion,
  type FixedAssetDeferredTaxLine,
  type FixedAssetDeferredTaxReport,
  getFixedAssetDeferredTaxReport,
  listEntityTaxRates,
  updateEntityTaxRate,
} from "@/services/accounting.service";

// ─── shared helpers ─────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Accepts both "2026-01-01" and a full ISO datetime; never re-zones. */
function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Rates are Decimal(6,3) strings ("20.000"). Not money, so `formatCurrency`
 * would be wrong here — but the value is still never re-computed client-side.
 */
function formatPercent(value: string | number): string {
  return `${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })}%`;
}

const EXCLUSION_LABEL: Record<DeferredTaxExclusionReason, string> = {
  "no-tax-basis":
    "No tax basis on the asset — set the tax cost / tax life before it can be scheduled",
  "no-tax-rate": "No tax rate in force on the as-of date",
};

const EXCLUSION_BADGE: Record<DeferredTaxExclusionReason, string> = {
  "no-tax-basis": "No tax basis",
  "no-tax-rate": "No rate",
};

type CoverageTone = "full" | "partial" | "none";

// Full literals — a `border-${tone}-500` string is purged by the Tailwind scan.
const COVERAGE_BOX: Record<CoverageTone, string> = {
  full: "border-emerald-500/40 bg-emerald-500/5",
  partial: "border-amber-500/50 bg-amber-500/10",
  none: "border-destructive/50 bg-destructive/10",
};

const COVERAGE_TEXT: Record<CoverageTone, string> = {
  full: "text-emerald-700 dark:text-emerald-300",
  partial: "text-amber-700 dark:text-amber-300",
  none: "text-destructive",
};

const COVERAGE_BAR: Record<CoverageTone, string> = {
  full: "bg-emerald-500",
  partial: "bg-amber-500",
  none: "bg-destructive",
};

function coverageTone(
  coverage: FixedAssetDeferredTaxReport["coverage"],
): CoverageTone {
  if (coverage.assetsIncluded === 0) return "none";
  if (coverage.assetsExcluded === 0) return "full";
  return "partial";
}

const sectionLabel = `
  text-muted-foreground text-[10px] font-semibold tracking-wider uppercase
`;

// ─── deferred tax schedule ──────────────────────────────────────────────────

interface PanelProps {
  entityId: string;
  /** ACCOUNTING_ADMIN — gates the effective-dated rate manager. */
  canAdmin: boolean;
  /** Bump to force a re-run (e.g. after a depreciation post). */
  refreshKey?: number;
  /** Called after a rate change restates the schedule. */
  onActioned?: () => void;
  /**
   * Render the rate manager inside this panel (default). Pass false when the
   * parent mounts `EntityTaxRateManager` somewhere else, e.g. a Setup tab.
   */
  embedRateManager?: boolean;
}

export function FixedAssetDeferredTaxPanel({
  entityId,
  canAdmin,
  refreshKey = 0,
  onActioned,
  embedRateManager = true,
}: PanelProps) {
  const [asOf, setAsOf] = useState(todayIso());
  const [report, setReport] = useState<FixedAssetDeferredTaxReport | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      const res = await getFixedAssetDeferredTaxReport({ entityId, asOf });
      setReport(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load the deferred tax schedule",
      );
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [entityId, asOf]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const handleRatesChanged = useCallback(() => {
    void load();
    onActioned?.();
  }, [load, onActioned]);

  const columns = [
    {
      key: "asset",
      mobileRole: "title" as const,
      header: "Asset",
      render: (l: FixedAssetDeferredTaxLine) => (
        <div>
          <div className="font-medium">{l.assetNo ?? "—"}</div>
          <div className="text-muted-foreground text-xs">{l.name}</div>
        </div>
      ),
    },
    {
      key: "categoryCode",
      mobileRole: "subtitle" as const,
      header: "Category",
      render: (l: FixedAssetDeferredTaxLine) => (
        <span className="text-muted-foreground text-xs">{l.categoryCode}</span>
      ),
    },
    {
      key: "bookCarrying",
      mobileRole: "detail" as const,
      header: "Book carrying",
      className: "text-right",
      render: (l: FixedAssetDeferredTaxLine) => (
        <span className="tabular-nums">{formatCurrency(l.bookCarrying)}</span>
      ),
    },
    {
      key: "taxWdv",
      mobileRole: "detail" as const,
      header: "Tax WDV",
      className: "text-right",
      render: (l: FixedAssetDeferredTaxLine) => (
        <span className="tabular-nums">{formatCurrency(l.taxWdv)}</span>
      ),
    },
    {
      key: "temporaryDifference",
      mobileRole: "field" as const,
      header: "Temp. difference",
      className: "text-right",
      render: (l: FixedAssetDeferredTaxLine) => (
        <span className="tabular-nums">
          {formatCurrency(l.temporaryDifference)}
        </span>
      ),
    },
    {
      key: "ratePercent",
      mobileRole: "detail" as const,
      header: "Rate",
      className: "text-right",
      render: (l: FixedAssetDeferredTaxLine) => (
        <span className="tabular-nums">{formatPercent(l.ratePercent)}</span>
      ),
    },
    {
      key: "deferredTax",
      mobileRole: "field" as const,
      header: "Deferred tax",
      className: "text-right",
      render: (l: FixedAssetDeferredTaxLine) => (
        <div className="flex items-center justify-end gap-2">
          <span
            className={
              l.deferredTax < 0
                ? "tabular-nums text-emerald-600 dark:text-emerald-400"
                : "tabular-nums text-amber-700 dark:text-amber-300"
            }
          >
            {formatCurrency(l.deferredTax)}
          </span>
          <Badge variant={l.deferredTax < 0 ? "green" : "amber"}>
            {l.deferredTax < 0 ? "DTA" : "DTL"}
          </Badge>
        </div>
      ),
    },
  ];

  const exclusionColumns = [
    {
      key: "asset",
      header: "Asset",
      render: (x: FixedAssetDeferredTaxExclusion) => (
        <div>
          <div className="font-medium">{x.assetNo ?? "—"}</div>
          <div className="text-muted-foreground text-xs">{x.name}</div>
        </div>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (x: FixedAssetDeferredTaxExclusion) => (
        <div className="flex items-center gap-2">
          <Badge variant="red">{EXCLUSION_BADGE[x.reason]}</Badge>
          <span className="text-muted-foreground text-xs">
            {EXCLUSION_LABEL[x.reason]}
          </span>
        </div>
      ),
    },
  ];

  const tone = report ? coverageTone(report.coverage) : "none";
  const percent = report?.coverage.percentIncluded;

  return (
    <div className="flex flex-col gap-3">
      <section
        className={`border-border bg-card overflow-hidden rounded-xl border`}
      >
        <div
          className={`
            border-border flex flex-col gap-2 border-b px-5 py-3
            md:flex-row md:items-center
          `}
        >
          <div>
            <p className={sectionLabel}>Deferred tax — fixed assets</p>
            <p className="text-muted-foreground mt-1 text-xs">
              The fixed-asset component only. Provisions, unrealised FX and
              employee benefits sit outside this schedule — never present it as
              the entity&apos;s whole deferred tax position.
            </p>
          </div>
          <div
            className={`
              flex items-center gap-2
              md:ml-auto
            `}
          >
            <Input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="h-9 text-xs"
              aria-label="As of date"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-3.5" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {report ? (
            <>
              <div
                className={`
                  flex flex-col gap-3 rounded-lg border p-4
                  ${COVERAGE_BOX[tone]}
                `}
              >
                <div className="flex items-start gap-3">
                  {tone === "full" ? (
                    <CheckCircle2
                      className={`
                        mt-0.5 size-4 shrink-0
                        ${COVERAGE_TEXT[tone]}
                      `}
                    />
                  ) : (
                    <AlertTriangle
                      className={`
                        mt-0.5 size-4 shrink-0
                        ${COVERAGE_TEXT[tone]}
                      `}
                    />
                  )}
                  <div className="flex-1">
                    <p
                      className={`
                        text-sm font-semibold
                        ${COVERAGE_TEXT[tone]}
                      `}
                    >
                      Covers {report.coverage.assetsIncluded} of{" "}
                      {report.coverage.assetsIncluded +
                        report.coverage.assetsExcluded}{" "}
                      assets
                      {percent === null ? "" : ` (${percent}%)`}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {report.coverage.assetsExcluded > 0
                        ? `${report.coverage.assetsExcluded} asset(s) are excluded and contribute nothing to the totals below. Clear the exclusions before treating this schedule as complete.`
                        : "Every asset in the register is scheduled."}
                    </p>
                  </div>
                </div>
                <div className="bg-foreground/10 h-1.5 w-full rounded-full">
                  <div
                    className={`
                      h-1.5 rounded-full
                      ${COVERAGE_BAR[tone]}
                    `}
                    style={{ width: `${percent ?? 0}%` }}
                  />
                </div>
              </div>

              {report.ratePercent === null ? (
                <div
                  className={`
                    border-destructive/50 bg-destructive/10 text-destructive
                    flex items-start gap-3 rounded-lg border p-4 text-xs
                  `}
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>
                    No corporate income tax rate is in force on{" "}
                    {dateOnly(report.asOf)}. Every asset is excluded and the
                    totals are zero — add an effective-dated rate below.
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Rate applied: {formatPercent(report.ratePercent)}
                  {report.rateLabel ? ` — ${report.rateLabel}` : ""} · as at{" "}
                  {dateOnly(report.asOf)}
                </p>
              )}

              <div
                className={`
                  grid grid-cols-2 gap-3
                  lg:grid-cols-6
                `}
              >
                <Stat
                  label="Book carrying"
                  value={formatCurrency(report.totals.bookCarrying)}
                />
                <Stat
                  label="Tax WDV"
                  value={formatCurrency(report.totals.taxWdv)}
                />
                <Stat
                  label="Temporary difference"
                  value={formatCurrency(report.totals.temporaryDifference)}
                />
                <Stat
                  label="Gross DTL"
                  value={formatCurrency(report.totals.deferredTaxLiability)}
                  hint="Taxable differences"
                  tone="liability"
                />
                <Stat
                  label="Gross DTA"
                  value={formatCurrency(report.totals.deferredTaxAsset)}
                  hint="Deductible differences"
                  tone="asset"
                />
                <Stat
                  label="Net position"
                  value={formatCurrency(report.totals.deferredTax)}
                  hint="+ liability / − asset"
                />
              </div>

              <p className="text-muted-foreground text-[11px]">
                Gross DTL and gross DTA are shown separately: IAS 12 offsetting
                is an entity-level judgement, and a net figure alone hides a
                large asset sitting against a large liability. All totals come
                from the server payload, not from the rows on screen.
              </p>
            </>
          ) : null}

          <div className="space-y-2">
            <p className={sectionLabel}>
              Scheduled assets ({report ? report.lines.length : 0})
            </p>
            <DataTable
              columns={columns}
              data={report?.lines ?? []}
              loading={loading}
              emptyMessage="No assets are in the deferred tax schedule"
            />
          </div>

          {report && report.exclusions.length > 0 ? (
            <div className="space-y-2">
              <p
                className={`
                  text-destructive text-[10px] font-semibold tracking-wider
                  uppercase
                `}
              >
                Excluded from the schedule ({report.exclusions.length})
              </p>
              <DataTable
                columns={exclusionColumns}
                data={report.exclusions}
                emptyMessage="No exclusions"
              />
            </div>
          ) : null}
        </div>
      </section>

      {embedRateManager ? (
        <EntityTaxRateManager
          entityId={entityId}
          canAdmin={canAdmin}
          onActioned={handleRatesChanged}
        />
      ) : null}
    </div>
  );
}

const STAT_TONE: Record<"neutral" | "liability" | "asset", string> = {
  neutral: "text-foreground",
  liability: "text-amber-700 dark:text-amber-300",
  asset: "text-emerald-700 dark:text-emerald-300",
};

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "liability" | "asset";
}) {
  return (
    <div className="border-border rounded-lg border p-3">
      <p className={sectionLabel}>{label}</p>
      <p
        className={`
          mt-1 text-sm font-semibold tabular-nums
          ${STAT_TONE[tone]}
        `}
      >
        {value}
      </p>
      {hint ? (
        <p className="text-muted-foreground mt-0.5 text-[10px]">{hint}</p>
      ) : null}
    </div>
  );
}

// ─── entity tax rate manager ────────────────────────────────────────────────

const rateSchema = z
  .object({
    effectiveFrom: z.string().min(1, "Effective from is required"),
    effectiveTo: z.string(),
    ratePercent: z.string().min(1, "Rate is required"),
    label: z.string().max(120),
  })
  .refine(
    (v) => {
      const n = Number(v.ratePercent);
      return Number.isFinite(n) && n >= 0 && n <= 100;
    },
    { message: "Rate must be between 0 and 100", path: ["ratePercent"] },
  )
  .refine((v) => !v.effectiveTo || v.effectiveTo >= v.effectiveFrom, {
    message: "End date must not be before start date",
    path: ["effectiveTo"],
  });

type RateFormValues = z.infer<typeof rateSchema>;

const EMPTY_RATE: RateFormValues = {
  effectiveFrom: todayIso(),
  effectiveTo: "",
  ratePercent: "20",
  label: "",
};

interface RateManagerProps {
  entityId: string;
  /** ACCOUNTING_ADMIN — read is admin-only too, so a non-admin sees nothing. */
  canAdmin: boolean;
  refreshKey?: number;
  onActioned?: () => void;
}

export function EntityTaxRateManager({
  entityId,
  canAdmin,
  refreshKey = 0,
  onActioned,
}: RateManagerProps) {
  const [rates, setRates] = useState<EntityTaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EntityTaxRate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EntityTaxRate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<RateFormValues>({
    resolver: zodResolver(rateSchema),
    defaultValues: EMPTY_RATE,
  });

  const load = useCallback(async () => {
    if (!entityId || !canAdmin) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await listEntityTaxRates({ entityId });
      setRates(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load tax rates",
      );
    } finally {
      setLoading(false);
    }
  }, [entityId, canAdmin]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  function openCreate() {
    setEditing(null);
    form.reset(EMPTY_RATE);
    setDialogOpen(true);
  }

  function openEdit(r: EntityTaxRate) {
    setEditing(r);
    form.reset({
      effectiveFrom: dateOnly(r.effectiveFrom),
      effectiveTo: r.effectiveTo ? dateOnly(r.effectiveTo) : "",
      ratePercent: String(Number(r.ratePercent)),
      label: r.label ?? "",
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: RateFormValues) {
    try {
      setSubmitting(true);
      const payload = {
        effectiveFrom: values.effectiveFrom,
        // Explicit null (not omitted) so an edit can re-open a closed period.
        effectiveTo: values.effectiveTo || null,
        ratePercent: Number(values.ratePercent),
        label: values.label.trim() || null,
      };
      if (editing) {
        await updateEntityTaxRate(editing.id, payload);
        toast.success("Tax rate updated");
      } else {
        await createEntityTaxRate({ entityId, ...payload });
        toast.success("Tax rate added");
      }
      setDialogOpen(false);
      await load();
      onActioned?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save the tax rate",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteEntityTaxRate(deleteTarget.id);
      toast.success("Tax rate deleted");
      setDeleteTarget(null);
      await load();
      onActioned?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete the tax rate",
      );
    } finally {
      setDeleting(false);
    }
  }

  const today = todayIso();
  const inForce = (r: EntityTaxRate) =>
    dateOnly(r.effectiveFrom) <= today &&
    (!r.effectiveTo || dateOnly(r.effectiveTo) >= today);

  const columns = [
    {
      key: "effectiveFrom",
      mobileRole: "title" as const,
      header: "Effective from",
      render: (r: EntityTaxRate) => (
        <span className="font-medium tabular-nums">
          {dateOnly(r.effectiveFrom)}
        </span>
      ),
    },
    {
      key: "effectiveTo",
      mobileRole: "field" as const,
      header: "Effective to",
      render: (r: EntityTaxRate) =>
        r.effectiveTo ? (
          <span className="tabular-nums">{dateOnly(r.effectiveTo)}</span>
        ) : (
          <span className="text-muted-foreground text-xs">Open-ended</span>
        ),
    },
    {
      key: "ratePercent",
      mobileRole: "field" as const,
      header: "Rate",
      className: "text-right",
      render: (r: EntityTaxRate) => (
        <span className="tabular-nums">{formatPercent(r.ratePercent)}</span>
      ),
    },
    {
      key: "label",
      mobileRole: "subtitle" as const,
      header: "Label",
      render: (r: EntityTaxRate) =>
        r.label ? (
          <span className="text-xs">{r.label}</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: "status",
      mobileRole: "badge" as const,
      header: "Status",
      render: (r: EntityTaxRate) =>
        inForce(r) ? (
          <Badge variant="green">In force</Badge>
        ) : (
          <Badge variant="grey">Not current</Badge>
        ),
    },
    {
      key: "actions",
      mobileRole: "actions" as const,
      header: "",
      className: "w-20 text-right",
      render: (r: EntityTaxRate) => {
        if (!canAdmin) return null;
        return (
          <div className="inline-flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(r)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDeleteTarget(r)}
            >
              <Trash2 className="text-destructive size-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];

  if (!canAdmin) return null;

  return (
    <section className="border-border bg-card overflow-hidden rounded-xl border">
      <div
        className={`
          border-border flex flex-col gap-2 border-b px-5 py-3
          md:flex-row md:items-center
        `}
      >
        <div>
          <p className={sectionLabel}>Corporate income tax rates</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Effective-dated per entity, and periods must not overlap — exactly
            one rate is in force on any date. A BOI promotion is entered as its
            own dated row layered over the headline rate (e.g. 0% for the
            promoted years, then back to 20%), not as an edit to the headline
            row.
          </p>
        </div>
        <div
          className={`
            flex items-center gap-2
            md:ml-auto
          `}
        >
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-3.5" />
            Add rate
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rates}
        loading={loading}
        emptyMessage="No tax rate configured — the deferred tax schedule will exclude every asset"
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (!submitting) setDialogOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit tax rate" : "Add tax rate"}
            </DialogTitle>
            <DialogDescription>
              Changing a rate restates deferred tax for every asset in the
              period. Overlapping periods are rejected — close the previous row
              first.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              id="entity-tax-rate-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="effectiveFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective from</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="effectiveTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective to</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      Leave blank for an open-ended period.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ratePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.001"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      0 is a legitimate rate (a BOI-promoted period) and is not
                      the same as leaving the period unconfigured.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Headline CIT 20% / BOI promotion"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="entity-tax-rate-form"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tax rate?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Delete the ${formatPercent(deleteTarget.ratePercent)} rate effective from ${dateOnly(deleteTarget.effectiveFrom)}. Any date the deleted row covered will have no rate in force, and every asset falls out of the deferred tax schedule for that date.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
