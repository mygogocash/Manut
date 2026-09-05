"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Loader2,
  Lock,
  Plus,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  ALL_FILTER,
  formatDate,
} from "@/components/accounting/accounting-utils";
import { Badge, type BadgeVariant } from "@/components/shared/badge";
import { DataTable } from "@/components/shared/data-table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  closeFixedAssetCountSession,
  createFixedAssetCountSession,
  FIXED_ASSET_COUNT_SESSION_STATUSES,
  type FixedAssetCountLineStatus,
  type FixedAssetCountSession,
  type FixedAssetCountSessionStatus,
  type FixedAssetCountVariance,
  type FixedAssetCountVarianceLine,
  getFixedAssetCountVariance,
  listFixedAssetCountSessions,
  submitFixedAssetCountLine,
} from "@/services/accounting.service";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const SESSION_STATUS_LABELS: Record<FixedAssetCountSessionStatus, string> = {
  open: "Open",
  closed: "Closed",
};

const LINE_STATUS_LABELS: Record<FixedAssetCountLineStatus, string> = {
  matched: "Matched",
  shortfall: "Shortfall",
  surplus: "Surplus",
  "not-counted": "Not counted",
  unregistered: "Unregistered",
};

/**
 * Literal maps only — Tailwind scans source text, so a template string like
 * `bg-${status}-500` is purged and the row loses its colour entirely.
 */
const LINE_STATUS_VARIANTS: Record<FixedAssetCountLineStatus, BadgeVariant> = {
  matched: "green",
  shortfall: "red",
  surplus: "blue",
  "not-counted": "amber",
  unregistered: "purple",
};

const LINE_STATUS_ROW_CLASS: Record<FixedAssetCountLineStatus, string> = {
  matched: "",
  shortfall: "bg-red-500/5",
  surplus: "bg-blue-500/5",
  "not-counted": "bg-amber-500/5",
  unregistered: "bg-purple-500/5",
};

const LINE_STATUS_DOT_CLASS: Record<FixedAssetCountLineStatus, string> = {
  matched: "bg-emerald-500",
  shortfall: "bg-red-500",
  surplus: "bg-blue-500",
  "not-counted": "bg-amber-500",
  unregistered: "bg-purple-500",
};

const LINE_STATUS_HELP: Record<FixedAssetCountLineStatus, string> = {
  matched: "Units found equal the units expected at the as-at date.",
  shortfall: "Fewer units found than expected — some units are missing.",
  surplus: "More units found than the register expects for this asset.",
  "not-counted":
    "The count never reached this asset. This is NOT a count of zero — nobody asserted the asset is gone, so it must not be written off on the strength of this row.",
  unregistered:
    "A tag was found on the floor that is not in the register. Add the asset (or correct the tag) — it is not a variance to write off.",
};

const LINE_STATUS_ORDER: FixedAssetCountLineStatus[] = [
  "matched",
  "shortfall",
  "surplus",
  "not-counted",
  "unregistered",
];

const createSchema = z.object({
  asOfDate: z.string().min(1, "An as-at date is required"),
  name: z.string().max(200),
  locationFilter: z.string().max(200),
});

type CreateFormValues = z.infer<typeof createSchema>;

interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  onCreated: (session: FixedAssetCountSession) => void;
}

function CreateCountSessionDialog({
  open,
  onOpenChange,
  entityId,
  onCreated,
}: CreateSessionDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { asOfDate: todayIso(), name: "", locationFilter: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ asOfDate: todayIso(), name: "", locationFilter: "" });
    }
  }, [open, form]);

  async function onSubmit(values: CreateFormValues) {
    if (!entityId) return;
    try {
      setSubmitting(true);
      const res = await createFixedAssetCountSession({
        entityId,
        asOfDate: values.asOfDate,
        name: values.name.trim() || null,
        locationFilter: values.locationFilter.trim() || null,
      });
      toast.success(`Count session ${res.data.sessionNo} opened`);
      onCreated(res.data);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to open count session",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New physical count</DialogTitle>
          <DialogDescription>
            Expected quantities are resolved at the as-at date, not at today, so
            a count of last month&apos;s floor still compares against last
            month&apos;s register.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="fa-count-session-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="asOfDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>As at</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Q3 head-office count" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="locationFilter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location filter (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Floor 12" {...field} />
                  </FormControl>
                  <FormDescription>
                    Narrows the expected set to assets at this location. Leave
                    blank to count the whole entity — assets outside the filter
                    are excluded from the session, not reported as missing.
                  </FormDescription>
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
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="fa-count-session-form"
            disabled={submitting || !entityId}
          >
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Open session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SummaryTileProps {
  label: string;
  value: number;
  dotClass?: string;
  hint?: string;
}

function SummaryTile({ label, value, dotClass, hint }: SummaryTileProps) {
  return (
    <div
      className="border-border bg-surface rounded-lg border px-3 py-2"
      title={hint}
    >
      <p
        className={`
          text-muted-foreground flex items-center gap-1.5 text-[10px]
          font-semibold tracking-wider uppercase
        `}
      >
        {dotClass ? (
          <span className={cn("size-1.5 shrink-0 rounded-full", dotClass)} />
        ) : null}
        {label}
      </p>
      <p className="text-lg tabular-nums">{value}</p>
    </div>
  );
}

interface Props {
  entityId: string;
  /** accounting:create — opening a session and recording scans. */
  canCreate: boolean;
  /** accounting:approve — closing (freezing) a session. */
  canApprove?: boolean;
  /** Bumped by the parent to force a re-fetch. */
  refreshKey?: number;
  /** Called after a scan / close so the parent can re-fetch the register. */
  onActioned?: () => void;
}

export function FixedAssetCountPanel({
  entityId,
  canCreate,
  canApprove = false,
  refreshKey = 0,
  onActioned,
}: Props) {
  const [sessions, setSessions] = useState<FixedAssetCountSession[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_FILTER);
  const [loadingSessions, setLoadingSessions] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [variance, setVariance] = useState<FixedAssetCountVariance | null>(
    null,
  );
  const [loadingVariance, setLoadingVariance] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [scanValue, setScanValue] = useState("");
  const [scanQty, setScanQty] = useState("1");
  const [scanning, setScanning] = useState(false);
  const [closing, setClosing] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const loadSessions = useCallback(async () => {
    if (!entityId) {
      setSessions([]);
      setLoadingSessions(false);
      return;
    }
    try {
      setLoadingSessions(true);
      const res = await listFixedAssetCountSessions({
        entityId,
        status:
          statusFilter === ALL_FILTER
            ? undefined
            : (statusFilter as FixedAssetCountSessionStatus),
      });
      setSessions(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load count sessions",
      );
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, [entityId, statusFilter]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions, refreshKey]);

  // An entity switch invalidates the open session — its variance belongs to the
  // previous entity's register.
  useEffect(() => {
    setSelectedId(null);
    setVariance(null);
  }, [entityId]);

  const loadVariance = useCallback(async (sessionId: string) => {
    try {
      setLoadingVariance(true);
      const res = await getFixedAssetCountVariance(sessionId);
      setVariance(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load the variance",
      );
      setVariance(null);
    } finally {
      setLoadingVariance(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setVariance(null);
      return;
    }
    void loadVariance(selectedId);
  }, [selectedId, loadVariance]);

  const submitScan = useCallback(async () => {
    const tag = scanValue.trim();
    if (!selectedId || !tag) return;
    const qty = Number(scanQty);
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error("Counted quantity must be zero or more");
      return;
    }
    try {
      setScanning(true);
      const res = await submitFixedAssetCountLine(selectedId, {
        scannedTag: tag,
        countedQuantity: qty,
      });
      if (res.data.resolution === "unregistered") {
        toast.warning(`"${tag}" is not in the register — logged as found`);
      } else if (qty === 0) {
        toast.success(`"${tag}" recorded as nothing found (0 units)`);
      } else {
        toast.success(`"${tag}" counted — ${qty} unit(s)`);
      }
      setScanValue("");
      setScanQty("1");
      await loadVariance(selectedId);
      onActioned?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to record the scan",
      );
    } finally {
      setScanning(false);
      // Keyboard-wedge scanners fire the next code straight away — the field
      // has to be focused again or the scan lands nowhere.
      scanRef.current?.focus();
    }
  }, [scanValue, scanQty, selectedId, loadVariance, onActioned]);

  const closeSession = useCallback(async () => {
    if (!selectedId) return;
    if (
      !window.confirm(
        "Close this count session? A closed session accepts no further scans.",
      )
    ) {
      return;
    }
    try {
      setClosing(true);
      await closeFixedAssetCountSession(selectedId);
      toast.success("Count session closed");
      await loadVariance(selectedId);
      await loadSessions();
      onActioned?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to close the session",
      );
    } finally {
      setClosing(false);
    }
  }, [selectedId, loadVariance, loadSessions, onActioned]);

  const sessionColumns = [
    {
      key: "sessionNo",
      mobileRole: "title" as const,
      header: "Session",
      render: (s: FixedAssetCountSession) => (
        <div>
          <div className="font-medium">{s.sessionNo}</div>
          {s.name ? (
            <div className="text-muted-foreground text-xs">{s.name}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: "asOfDate",
      mobileRole: "subtitle" as const,
      header: "As at",
      render: (s: FixedAssetCountSession) => (
        <span className="tabular-nums">{formatDate(s.asOfDate)}</span>
      ),
    },
    {
      key: "locationFilter",
      mobileRole: "detail" as const,
      header: "Location",
      render: (s: FixedAssetCountSession) => (
        <span className="text-muted-foreground text-xs">
          {s.locationFilter ?? "All locations"}
        </span>
      ),
    },
    {
      key: "lines",
      mobileRole: "field" as const,
      header: "Scans",
      className: "text-right",
      render: (s: FixedAssetCountSession) => (
        <span className="tabular-nums">{s._count?.lines ?? 0}</span>
      ),
    },
    {
      key: "status",
      mobileRole: "badge" as const,
      header: "Status",
      render: (s: FixedAssetCountSession) => (
        <Badge variant={s.status === "open" ? "blue" : "grey"}>
          {SESSION_STATUS_LABELS[s.status]}
        </Badge>
      ),
    },
  ];

  const varianceColumns = [
    {
      key: "asset",
      mobileRole: "title" as const,
      header: "Asset",
      render: (l: FixedAssetCountVarianceLine) => (
        <div>
          <div className="font-medium">
            {l.assetNo ?? l.scannedTag ?? "—"}
            {l.assetNo === null && l.scannedTag ? (
              <span className="text-muted-foreground ml-1 text-xs">
                (scanned tag)
              </span>
            ) : null}
          </div>
          <div className="text-muted-foreground text-xs">{l.name}</div>
        </div>
      ),
    },
    {
      key: "categoryCode",
      mobileRole: "subtitle" as const,
      header: "Category",
      render: (l: FixedAssetCountVarianceLine) => (
        <span className="text-muted-foreground text-xs">
          {l.categoryCode ?? "—"}
        </span>
      ),
    },
    {
      key: "location",
      mobileRole: "detail" as const,
      header: "Location",
      render: (l: FixedAssetCountVarianceLine) => (
        <span className="text-muted-foreground text-xs">
          {l.location ?? "—"}
        </span>
      ),
    },
    {
      key: "expectedQuantity",
      mobileRole: "detail" as const,
      header: "Expected",
      className: "text-right",
      render: (l: FixedAssetCountVarianceLine) => (
        <span className="tabular-nums">{l.expectedQuantity}</span>
      ),
    },
    {
      key: "countedQuantity",
      mobileRole: "field" as const,
      header: "Counted",
      className: "text-right",
      render: (l: FixedAssetCountVarianceLine) =>
        l.status === "not-counted" ? (
          // A blank is the honest render: nobody looked, so there is no count.
          // Printing "0" here is what gets a live asset written off.
          <span className="text-muted-foreground text-xs">not counted</span>
        ) : (
          <span className="tabular-nums">{l.countedQuantity}</span>
        ),
    },
    {
      key: "variance",
      mobileRole: "field" as const,
      header: "Variance",
      className: "text-right",
      render: (l: FixedAssetCountVarianceLine) => {
        if (l.status === "not-counted") {
          return <span className="text-muted-foreground text-xs">—</span>;
        }
        return (
          <span
            className={
              l.variance < 0
                ? "text-destructive tabular-nums"
                : l.variance > 0
                  ? "tabular-nums text-blue-600"
                  : "text-muted-foreground tabular-nums"
            }
          >
            {l.variance > 0 ? `+${l.variance}` : l.variance}
          </span>
        );
      },
    },
    {
      key: "status",
      mobileRole: "badge" as const,
      header: "Status",
      render: (l: FixedAssetCountVarianceLine) => (
        <Badge variant={LINE_STATUS_VARIANTS[l.status]}>
          {LINE_STATUS_LABELS[l.status]}
        </Badge>
      ),
    },
    {
      key: "suggestWriteOff",
      mobileRole: "detail" as const,
      header: "Action",
      render: (l: FixedAssetCountVarianceLine) =>
        l.suggestWriteOff ? (
          <span
            className={`
              inline-flex items-center gap-1 text-xs font-medium text-amber-700
              dark:text-amber-300
            `}
          >
            <TriangleAlert className="size-3.5 shrink-0" />
            Write-off suggested
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: "note",
      mobileRole: "detail" as const,
      header: "Note",
      render: (l: FixedAssetCountVarianceLine) => (
        <span className="text-muted-foreground text-xs">{l.note ?? "—"}</span>
      ),
    },
  ];

  const summary = variance?.summary ?? null;
  const sessionOpen = variance?.session.status === "open";
  const flaggedCount = variance
    ? variance.lines.filter((l) => l.suggestWriteOff).length
    : 0;

  return (
    <section className="border-border bg-card overflow-hidden rounded-xl border">
      <div
        className={`
          border-border flex flex-col gap-2 border-b px-5 py-3
          md:flex-row md:items-center
        `}
      >
        <div className="flex items-center gap-2">
          {selectedId ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Back to sessions"
              onClick={() => setSelectedId(null)}
            >
              <ArrowLeft className="size-3.5" />
            </Button>
          ) : null}
          <div>
            <p
              className={`
                text-muted-foreground text-[10px] font-semibold tracking-wider
                uppercase
              `}
            >
              Physical count
            </p>
            {variance ? (
              <p className="text-sm">
                {variance.session.sessionNo} · as at{" "}
                {formatDate(variance.session.asOfDate)}
                {variance.session.name ? ` · ${variance.session.name}` : ""}
                {variance.session.locationFilter
                  ? ` · ${variance.session.locationFilter}`
                  : ""}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className={`
            flex flex-wrap items-center gap-2
            md:ml-auto
          `}
        >
          {selectedId ? (
            <>
              {variance ? (
                <Badge variant={sessionOpen ? "blue" : "grey"}>
                  {SESSION_STATUS_LABELS[variance.session.status]}
                </Badge>
              ) : null}
              {canApprove && sessionOpen ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void closeSession()}
                  disabled={closing}
                >
                  {closing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Lock className="size-3.5" />
                  )}
                  Close session
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 min-w-[130px] text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                  {FIXED_ASSET_COUNT_SESSION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SESSION_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canCreate ? (
                <Button
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  disabled={!entityId}
                >
                  <Plus className="size-3.5" />
                  New count
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {selectedId ? (
        <div className="flex flex-col gap-4 p-5">
          {canCreate && sessionOpen ? (
            <div
              className={`
                border-border bg-surface flex flex-col gap-2 rounded-lg border
                p-3
                md:flex-row md:items-end
              `}
            >
              <label className="flex flex-1 flex-col gap-1 text-xs">
                <span
                  className={`
                    text-muted-foreground flex items-center gap-1.5 font-medium
                  `}
                >
                  <ScanLine className="size-3.5" />
                  Scan or type an asset tag, then press Enter
                </span>
                <Input
                  ref={scanRef}
                  name="fa-count-scan"
                  value={scanValue}
                  autoFocus
                  autoComplete="off"
                  disabled={scanning}
                  placeholder="Asset tag / barcode"
                  onChange={(e) => setScanValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    void submitScan();
                  }}
                  className="h-10 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground font-medium">
                  Units found
                </span>
                <Input
                  name="fa-count-qty"
                  type="number"
                  min="0"
                  step="1"
                  value={scanQty}
                  disabled={scanning}
                  onChange={(e) => setScanQty(e.target.value)}
                  className="h-10 w-28 text-sm"
                />
              </label>
              <Button
                onClick={() => void submitScan()}
                disabled={scanning || !scanValue.trim()}
              >
                {scanning && <Loader2 className="size-4 animate-spin" />}
                Record
              </Button>
            </div>
          ) : null}

          {canCreate && sessionOpen ? (
            <p className="text-muted-foreground text-xs">
              Recording <span className="font-medium">0 units</span> is a
              positive statement that nothing was there. Simply never scanning
              an asset leaves it{" "}
              <span className="font-medium">not counted</span> — a different
              thing, and not grounds for a write-off.
            </p>
          ) : null}

          {summary ? (
            <div
              className={`
                grid grid-cols-2 gap-2
                lg:grid-cols-4
                xl:grid-cols-8
              `}
            >
              {/* Server roll-up over the whole session — never re-derived from
                  the rows on screen. */}
              <SummaryTile
                label="Expected"
                value={summary.expectedAssets}
                hint="Assets the register expects in scope at the as-at date"
              />
              <SummaryTile
                label="Counted"
                value={summary.countedAssets}
                hint="Assets a scan actually reached"
              />
              <SummaryTile
                label="Matched"
                value={summary.matched}
                dotClass={LINE_STATUS_DOT_CLASS.matched}
              />
              <SummaryTile
                label="Shortfall"
                value={summary.shortfall}
                dotClass={LINE_STATUS_DOT_CLASS.shortfall}
              />
              <SummaryTile
                label="Surplus"
                value={summary.surplus}
                dotClass={LINE_STATUS_DOT_CLASS.surplus}
              />
              <SummaryTile
                label="Not counted"
                value={summary.notCounted}
                dotClass={LINE_STATUS_DOT_CLASS["not-counted"]}
                hint={LINE_STATUS_HELP["not-counted"]}
              />
              <SummaryTile
                label="Unregistered"
                value={summary.unregistered}
                dotClass={LINE_STATUS_DOT_CLASS.unregistered}
              />
              <SummaryTile
                label="Net units missing"
                value={summary.netUnitsMissing}
                hint="Net units missing across the session"
              />
            </div>
          ) : null}

          {flaggedCount > 0 ? (
            <div
              className={`
                flex items-start gap-2 rounded-lg border border-amber-500/40
                bg-amber-500/10 px-3 py-2 text-xs text-amber-900
                dark:text-amber-200
              `}
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <p>
                <span className="font-medium">
                  {flaggedCount} row(s) suggest a write-off.
                </span>{" "}
                This panel never writes one. Raise each through the normal
                dispose / write-off flow on the asset so it goes to the usual
                disposal approval.
              </p>
            </div>
          ) : null}

          <DataTable
            columns={varianceColumns}
            data={variance?.lines ?? []}
            loading={loadingVariance}
            emptyMessage="Nothing in scope for this session"
            getRowClassName={(l: FixedAssetCountVarianceLine) =>
              LINE_STATUS_ROW_CLASS[l.status]
            }
            getRowId={(l: FixedAssetCountVarianceLine, index: number) =>
              l.assetId ?? l.scannedTag ?? `__line_${index}`
            }
          />

          <div className="flex flex-col gap-1.5">
            {LINE_STATUS_ORDER.map((s) => (
              <p
                key={s}
                className={`
                  text-muted-foreground flex items-start gap-2 text-xs
                `}
              >
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    LINE_STATUS_DOT_CLASS[s],
                  )}
                />
                <span>
                  <span className="text-foreground font-medium">
                    {LINE_STATUS_LABELS[s]}
                  </span>{" "}
                  — {LINE_STATUS_HELP[s]}
                </span>
              </p>
            ))}
          </div>
        </div>
      ) : (
        <DataTable
          columns={sessionColumns}
          data={sessions}
          loading={loadingSessions}
          emptyMessage="No count sessions yet"
          onRowClick={(s: FixedAssetCountSession) => setSelectedId(s.id)}
        />
      )}

      <CreateCountSessionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        entityId={entityId}
        onCreated={(s) => {
          setCreateOpen(false);
          void loadSessions();
          setSelectedId(s.id);
          onActioned?.();
        }}
      />
    </section>
  );
}
