"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  formatCurrency,
  formatDate,
} from "@/components/accounting/accounting-utils";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  approveFixedAssetRemeasurement,
  FIXED_ASSET_REMEASUREMENT_KINDS,
  type FixedAsset,
  type FixedAssetRemeasurement,
  type FixedAssetRemeasurementKind,
  listFixedAssetRemeasurements,
  rejectFixedAssetRemeasurement,
  submitFixedAssetRemeasurement,
} from "@/services/accounting.service";

// Tailwind only sees full literals, so every variant class is spelled out in a
// static map — never `bg-${kind}-500`.
const KIND_LABELS: Record<FixedAssetRemeasurementKind, string> = {
  revaluation: "Revaluation",
  impairment: "Impairment",
  impairment_reversal: "Impairment reversal",
};

const KIND_BADGE_CLASS: Record<FixedAssetRemeasurementKind, string> = {
  revaluation: "bg-emerald-500/10 text-emerald-600",
  impairment: "bg-destructive/10 text-destructive",
  impairment_reversal: "bg-amber-500/10 text-amber-700",
};

const KIND_HELP: Record<FixedAssetRemeasurementKind, string> = {
  revaluation:
    "Writes the asset up (or reverses a surplus). Recognised in OCI up to the revaluation surplus; anything beyond it lands in profit or loss.",
  impairment:
    "Writes the asset down to its recoverable amount. Charged against any revaluation surplus first, then to profit or loss.",
  impairment_reversal:
    "Reverses a previously recognised impairment. Capped at the carrying amount the asset would have had if it had never been impaired (IAS 36.117).",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Sign class for a signed money string. Comparison only — no client math. */
function movementClass(value: string): string {
  return Number(value) < 0
    ? "text-destructive tabular-nums"
    : "tabular-nums text-emerald-600";
}

// ─── Submit dialog ──────────────────────────────────────────────────────────

const schema = z
  .object({
    kind: z.enum(FIXED_ASSET_REMEASUREMENT_KINDS),
    effectiveDate: z.string().min(1, "Effective date is required"),
    carryingAfter: z.string().min(1, "A new carrying amount is required"),
    reason: z.string().max(2000),
    evidenceUrl: z.string().max(500),
  })
  .refine(
    (v) =>
      Number.isFinite(Number(v.carryingAfter)) && Number(v.carryingAfter) >= 0,
    { message: "Enter a valid amount of 0 or more", path: ["carryingAfter"] },
  )
  .refine(
    (v) =>
      v.evidenceUrl.trim() === "" || /^https?:\/\//i.test(v.evidenceUrl.trim()),
    { message: "Enter a full http(s) URL", path: ["evidenceUrl"] },
  );

type FormValues = z.infer<typeof schema>;

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset | null;
  onSaved: () => void;
}

export function FixedAssetRemeasurementDialog({
  open,
  onOpenChange,
  asset,
  onSaved,
}: DialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: "revaluation",
      effectiveDate: todayIso(),
      carryingAfter: "",
      reason: "",
      evidenceUrl: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        kind: "revaluation",
        effectiveDate: todayIso(),
        carryingAfter: "",
        reason: "",
        evidenceUrl: "",
      });
    }
  }, [open, asset, form]);

  const kind = form.watch("kind");
  const carryingAfterRaw = form.watch("carryingAfter");

  // Non-blocking hint only. The authoritative carrying amount is recomputed
  // server-side AT THE EFFECTIVE DATE, so a back-dated request can legitimately
  // disagree with the register's current net book value.
  let directionHint: string | null = null;
  const typed = Number(carryingAfterRaw);
  if (asset && carryingAfterRaw.trim() !== "" && Number.isFinite(typed)) {
    if (kind === "impairment" && typed >= asset.netBookValue) {
      directionHint =
        "An impairment must reduce the carrying amount. Raise a revaluation to write the asset up.";
    } else if (kind === "impairment_reversal" && typed <= asset.netBookValue) {
      directionHint =
        "An impairment reversal must increase the carrying amount.";
    }
  }

  async function onSubmit(values: FormValues) {
    if (!asset) return;
    try {
      setSubmitting(true);
      await submitFixedAssetRemeasurement(asset.id, {
        kind: values.kind,
        effectiveDate: values.effectiveDate,
        carryingAfter: Number(values.carryingAfter),
        reason: values.reason.trim() || null,
        evidenceUrl: values.evidenceUrl.trim() || null,
      });
      toast.success("Remeasurement submitted for approval");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to submit remeasurement",
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
          <DialogTitle>Remeasure asset</DialogTitle>
          <DialogDescription>
            {asset
              ? `${asset.assetNo} — ${asset.name}. The carrying amount before the event is computed at the effective date; the request needs approval before anything is recognised.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="fa-remeasurement-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kind</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FIXED_ASSET_REMEASUREMENT_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {KIND_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>{KIND_HELP[field.value]}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="effectiveDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Effective date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>
                    Governs the accounting period, not the approval date.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="carryingAfter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New carrying amount</FormLabel>
                  <div className="flex items-end gap-3">
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <div className="w-32 shrink-0 text-right">
                      <div
                        className={`
                          text-muted-foreground text-[10px] font-semibold
                          tracking-wider uppercase
                        `}
                      >
                        Current
                      </div>
                      <div className="text-sm font-medium tabular-nums">
                        {asset ? formatCurrency(asset.netBookValue) : "—"}
                      </div>
                    </div>
                  </div>
                  <FormDescription>
                    The revalued or recoverable amount. The movement and its
                    profit-or-loss / OCI split are computed server-side.
                  </FormDescription>
                  {directionHint ? (
                    <p className="text-xs text-amber-700">{directionHint}</p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason / basis</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="evidenceUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Evidence URL (optional)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://…" {...field} />
                  </FormControl>
                  <FormDescription>
                    Link to the valuation report or impairment memo.
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
            form="fa-remeasurement-form"
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Approval queue ─────────────────────────────────────────────────────────

type QueueView = "pending" | "approved";

interface QueueProps {
  entityId: string;
  canApprove: boolean;
  refreshKey: number;
  onActioned: () => void;
}

export function FixedAssetRemeasurementQueue({
  entityId,
  canApprove,
  refreshKey,
  onActioned,
}: QueueProps) {
  const [pending, setPending] = useState<FixedAssetRemeasurement[]>([]);
  const [approved, setApproved] = useState<FixedAssetRemeasurement[]>([]);
  const [view, setView] = useState<QueueView>("pending");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      const [pendingRes, approvedRes] = await Promise.all([
        listFixedAssetRemeasurements({ entityId, status: "pending" }),
        listFixedAssetRemeasurements({ entityId, status: "approved" }),
      ]);
      setPending(pendingRes.data);
      setApproved(approvedRes.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load remeasurements",
      );
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const approve = useCallback(
    async (r: FixedAssetRemeasurement) => {
      try {
        setActingId(r.id);
        await approveFixedAssetRemeasurement(r.id);
        toast.success("Remeasurement approved");
        await load();
        onActioned();
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Failed to approve",
        );
      } finally {
        setActingId(null);
      }
    },
    [load, onActioned],
  );

  const reject = useCallback(
    async (r: FixedAssetRemeasurement) => {
      const reason = window.prompt("Reason for rejecting this remeasurement?");
      if (reason === null) return;
      if (!reason.trim()) {
        toast.error("A rejection reason is required");
        return;
      }
      try {
        setActingId(r.id);
        await rejectFixedAssetRemeasurement(r.id, reason.trim());
        toast.success("Remeasurement rejected");
        await load();
        onActioned();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to reject");
      } finally {
        setActingId(null);
      }
    },
    [load, onActioned],
  );

  if (!loading && pending.length === 0 && approved.length === 0) return null;

  const rows = view === "pending" ? pending : approved;

  const columns = [
    {
      key: "asset",
      mobileRole: "title" as const,
      header: "Asset",
      render: (r: FixedAssetRemeasurement) => (
        <div>
          <div className="font-medium">{r.asset?.assetNo ?? "—"}</div>
          <div className="text-muted-foreground text-xs">{r.asset?.name}</div>
        </div>
      ),
    },
    {
      key: "kind",
      mobileRole: "subtitle" as const,
      header: "Kind",
      render: (r: FixedAssetRemeasurement) => (
        <div className="flex flex-col items-start gap-1">
          <Badge variant="ghost" className={KIND_BADGE_CLASS[r.kind]}>
            {KIND_LABELS[r.kind]}
          </Badge>
          {r.cappedAt ? (
            <span
              className="text-muted-foreground text-[10px]"
              title="Clipped to the never-impaired carrying amount (IAS 36.117)"
            >
              capped at {formatCurrency(r.cappedAt)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "effectiveDate",
      mobileRole: "detail" as const,
      header: "Effective",
      render: (r: FixedAssetRemeasurement) => (
        <span className="tabular-nums">{formatDate(r.effectiveDate)}</span>
      ),
    },
    {
      key: "carryingBefore",
      mobileRole: "detail" as const,
      header: "Carrying before",
      className: "text-right",
      render: (r: FixedAssetRemeasurement) => (
        <span className="tabular-nums">{formatCurrency(r.carryingBefore)}</span>
      ),
    },
    {
      key: "carryingAfter",
      mobileRole: "field" as const,
      header: "Carrying after",
      className: "text-right",
      render: (r: FixedAssetRemeasurement) => (
        <span className="tabular-nums">{formatCurrency(r.carryingAfter)}</span>
      ),
    },
    {
      key: "movement",
      mobileRole: "field" as const,
      header: "Movement",
      className: "text-right",
      render: (r: FixedAssetRemeasurement) => (
        <span className={movementClass(r.movement)}>
          {formatCurrency(r.movement)}
        </span>
      ),
    },
    {
      key: "profitOrLoss",
      mobileRole: "detail" as const,
      header: "Profit or loss",
      className: "text-right",
      render: (r: FixedAssetRemeasurement) => (
        <span className={movementClass(r.profitOrLoss)}>
          {formatCurrency(r.profitOrLoss)}
        </span>
      ),
    },
    {
      key: "oci",
      mobileRole: "detail" as const,
      header: "OCI",
      className: "text-right",
      render: (r: FixedAssetRemeasurement) => (
        <span className={movementClass(r.oci)}>{formatCurrency(r.oci)}</span>
      ),
    },
    ...(view === "approved"
      ? [
          {
            key: "balancesAfter",
            mobileRole: "detail" as const,
            header: "Balances after",
            className: "text-right",
            render: (r: FixedAssetRemeasurement) => (
              <div className="text-xs tabular-nums">
                <div>
                  <span className="text-muted-foreground">Surplus </span>
                  {formatCurrency(r.surplusAfter)}
                </div>
                <div>
                  <span className="text-muted-foreground">P&amp;L loss </span>
                  {formatCurrency(r.plLossAfter)}
                </div>
              </div>
            ),
          },
        ]
      : [
          {
            key: "actions",
            mobileRole: "actions" as const,
            header: "",
            className: "w-28 text-right",
            render: (r: FixedAssetRemeasurement) => {
              if (!canApprove) return null;
              const busy = actingId === r.id;
              return (
                <div className="inline-flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    onClick={() => void approve(r)}
                    aria-label="Approve"
                  >
                    {busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5 text-emerald-600" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    onClick={() => void reject(r)}
                    aria-label="Reject"
                  >
                    <X className="text-destructive size-3.5" />
                  </Button>
                </div>
              );
            },
          },
        ]),
  ];

  return (
    <section className="border-border bg-card overflow-hidden rounded-xl border">
      <div
        className={`
          border-border flex flex-wrap items-center justify-between gap-2
          border-b px-5 py-3
        `}
      >
        <div>
          <p
            className={`
              text-muted-foreground text-[10px] font-semibold tracking-wider
              uppercase
            `}
          >
            Asset remeasurements
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {view === "pending"
              ? "Indicative split — recomputed against live balances at approval."
              : "Recognised split: profit or loss vs other comprehensive income."}
          </p>
        </div>
        <div className="inline-flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={view === "pending" ? "secondary" : "ghost"}
            onClick={() => setView("pending")}
          >
            Pending
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "approved" ? "secondary" : "ghost"}
            onClick={() => setView("approved")}
          >
            Approved
          </Button>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        emptyMessage={
          view === "pending"
            ? "No pending remeasurements"
            : "No approved remeasurements"
        }
      />
    </section>
  );
}
