"use client";

import { Eye, Loader2, TriangleAlert, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { formatCurrency } from "@/components/accounting/accounting-utils";
import { Badge } from "@/components/shared/badge";
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
import { TableCell, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import {
  type FixedAssetDepreciationRun,
  type FixedAssetDepreciationRunCategory,
  previewFixedAssetDepreciationRun,
  runFixedAssetDepreciation,
} from "@/services/accounting.service";

const MONTH_LABELS = [
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

/** Matches the API's period key exactly (`YYYY-MM`), so it can be compared to `run.period`. */
function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Depreciation is normally run for the month that just closed, so the picker
 * opens on the previous month rather than the current (still-open) one.
 */
function defaultPeriod(): { year: number; month: number } {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

interface Props {
  entityId: string;
  /** `accounting:post` — the POST route is gated on it server-side too. */
  canPost: boolean;
  /** Bump to re-run the preview (e.g. after an approval changed the register). */
  refreshKey?: number;
  /** Called after a successful post so the parent can re-fetch the register. */
  onActioned?: () => void;
}

export function FixedAssetDepreciationRunPanel({
  entityId,
  canPost,
  refreshKey = 0,
  onActioned,
}: Props) {
  const [period, setPeriod] = useState(defaultPeriod);
  const { year, month } = period;

  const [run, setRun] = useState<FixedAssetDepreciationRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  // Kept out of the toast so the operator can still read it after it fades —
  // the usual failure here is "GL posting is off", which is a config answer,
  // not a transient error.
  const [postError, setPostError] = useState<string | null>(null);

  const selectedPeriod = periodKey(year, month);
  // A period change invalidates the loaded preview: the numbers on screen still
  // belong to the old month until Preview is pressed again.
  const stale = run !== null && run.period !== selectedPeriod;

  const preview = useCallback(
    async (y: number, m: number) => {
      if (!entityId) return;
      try {
        setLoading(true);
        setPostError(null);
        const res = await previewFixedAssetDepreciationRun({
          entityId,
          year: y,
          month: m,
        });
        setRun(res.data);
      } catch (err) {
        setRun(null);
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Failed to preview the depreciation run",
        );
      } finally {
        setLoading(false);
      }
    },
    [entityId],
  );

  // Read through a ref so the auto-preview fires on entity / refreshKey changes
  // only — a picker change must wait for an explicit Preview press.
  const periodRef = useRef(period);
  periodRef.current = period;

  useEffect(() => {
    // Safe on render: the GET is preview-only and never writes.
    void preview(periodRef.current.year, periodRef.current.month);
  }, [preview, refreshKey]);

  const post = useCallback(async () => {
    if (!entityId || !run || stale) return;
    const confirmed = window.confirm(
      `Post depreciation for ${run.period}? This writes a journal entry of ${formatCurrency(run.total)} and moves GL balances.`,
    );
    if (!confirmed) return;
    try {
      setPosting(true);
      setPostError(null);
      const res = await runFixedAssetDepreciation({
        entityId,
        year,
        month,
        post: true,
      });
      setRun(res.data);
      toast.success(
        res.data.entryNo
          ? `Depreciation ${res.data.period} posted as ${res.data.entryNo}`
          : `Depreciation ${res.data.period} posted`,
      );
      onActioned?.();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to post the depreciation run";
      setPostError(message);
      toast.error(message);
      // Re-read so `alreadyPosted` reflects the server after a 409.
      void preview(year, month);
    } finally {
      setPosting(false);
    }
  }, [entityId, run, stale, year, month, onActioned, preview]);

  const columns = useMemo(
    () => [
      {
        key: "categoryCode",
        header: "Category",
        render: (c: FixedAssetDepreciationRunCategory) => (
          <span className="font-medium">{c.categoryCode}</span>
        ),
      },
      {
        key: "assets",
        header: "Assets",
        className: "text-right",
        render: (c: FixedAssetDepreciationRunCategory) => (
          <span className="tabular-nums">{c.assets}</span>
        ),
      },
      {
        key: "charge",
        header: "Depreciation charge",
        className: "text-right",
        render: (c: FixedAssetDepreciationRunCategory) => (
          <span className="tabular-nums">{formatCurrency(c.charge)}</span>
        ),
      },
    ],
    [],
  );

  // Server roll-up over EVERY asset — never a reduce over the rows on screen.
  const footer = run ? (
    <TableRow
      className={`
        border-border bg-surface-secondary/50 border-t-2
        hover:bg-surface-secondary/50
      `}
    >
      <TableCell
        className={`
          text-muted-foreground text-right text-[10px] font-bold
          tracking-[0.12em] uppercase
        `}
      >
        Total
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {run.assetsCharged}
      </TableCell>
      <TableCell className="text-right font-semibold tabular-nums">
        {formatCurrency(run.total)}
      </TableCell>
    </TableRow>
  ) : null;

  // Two ways a period can already carry an entry: the preview found one
  // (`alreadyPosted`), or this session just created it (`posted` + `entryNo`,
  // with `alreadyPosted` still null because the server looked before writing).
  const postedEntryNo =
    run?.alreadyPosted?.entryNo ?? (run?.posted ? (run.entryNo ?? null) : null);
  const nothingToPost = run !== null && run.categories.length === 0;
  const postDisabled =
    !canPost ||
    !entityId ||
    !run ||
    stale ||
    loading ||
    posting ||
    postedEntryNo !== null ||
    nothingToPost;

  return (
    <section className="border-border bg-card overflow-hidden rounded-xl border">
      <div
        className={`
          border-border flex flex-col gap-2 border-b px-5 py-3
          md:flex-row md:items-center
        `}
      >
        <div>
          <p
            className={`
              text-muted-foreground text-[10px] font-semibold tracking-wider
              uppercase
            `}
          >
            Depreciation run
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Preview is read-only — nothing is written until you post.
          </p>
        </div>

        <div
          className={`
            flex flex-col gap-2
            md:ml-auto md:flex-row md:items-center
          `}
        >
          <Select
            value={String(month)}
            onValueChange={(v) =>
              setPeriod((p) => ({ ...p, month: Number(v) }))
            }
          >
            <SelectTrigger className="h-9 min-w-[130px] text-xs">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTH_LABELS.map((label, i) => (
                <SelectItem key={label} value={String(i + 1)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            min="2000"
            max="2100"
            step="1"
            value={year}
            onChange={(e) =>
              setPeriod((p) => ({ ...p, year: Number(e.target.value) }))
            }
            className="h-9 w-24 text-xs"
            aria-label="Year"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => void preview(year, month)}
            disabled={!entityId || loading || posting}
          >
            {loading ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            ) : (
              <Eye className="mr-2 size-3.5" />
            )}
            Preview
          </Button>

          {canPost ? (
            <Button
              size="sm"
              onClick={() => void post()}
              disabled={postDisabled}
            >
              {posting ? (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              ) : (
                <Upload className="mr-2 size-3.5" />
              )}
              Post to GL
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Period</span>
          <span className="font-medium tabular-nums">
            {run ? run.period : selectedPeriod}
          </span>
          {run ? (
            <span className="text-muted-foreground tabular-nums">
              ({run.openingAsOf} → {run.closingAsOf})
            </span>
          ) : null}
          {postedEntryNo ? (
            <Badge status="posted">Posted — {postedEntryNo}</Badge>
          ) : run ? (
            <Badge status="draft">Not posted</Badge>
          ) : null}
          {stale ? (
            <span className="text-warning">
              Period changed — press Preview to recompute.
            </span>
          ) : null}
        </div>

        {postedEntryNo ? (
          <p
            className={`
              border-border text-muted-foreground rounded-md border
              border-dashed p-2 text-[11px]
            `}
          >
            An entry already exists for {run?.period ?? selectedPeriod} (
            {postedEntryNo}). The run is idempotent on the period, so posting
            again is refused.
          </p>
        ) : null}

        {nothingToPost && !loading && !postedEntryNo ? (
          <p
            className={`
              border-border text-muted-foreground rounded-md border
              border-dashed p-2 text-[11px]
            `}
          >
            No depreciable charge for {run?.period ?? selectedPeriod} — nothing
            to post.
          </p>
        ) : null}

        {postError ? (
          <div
            className={`
              border-destructive/40 bg-destructive/5 text-destructive flex
              items-start gap-2 rounded-md border p-2 text-[11px]
            `}
          >
            <TriangleAlert className="mt-px size-3.5 shrink-0" />
            <span>{postError}</span>
          </div>
        ) : null}

        <DataTable
          columns={columns}
          data={run?.categories ?? []}
          loading={loading}
          getRowId={(c: FixedAssetDepreciationRunCategory) => c.categoryCode}
          emptyMessage="Run a preview to see the proposed journal"
          // Only three columns, so this is not about width: the card path
          // never renders `footer`, and this table's footer IS the run's
          // total depreciation charge. Measured at 320px: cards
          // totals=MISSING, table totals=YES at 417px inside a 286px
          // container, page overflow 0.
          mobileMode="table"
          footer={footer}
        />
      </div>
    </section>
  );
}
