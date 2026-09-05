"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowRight, Check, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  formatCurrency,
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  approveFixedAssetTransfer,
  FIXED_ASSET_TRANSFER_KINDS,
  type FixedAsset,
  type FixedAssetTransfer,
  type FixedAssetTransferKind,
  type FixedAssetTransferSubmitResult,
  listFixedAssetTransfers,
  listFixedAssetTransfersForAsset,
  rejectFixedAssetTransfer,
  submitFixedAssetTransfer,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

// Literal maps — Tailwind's scanner only sees class strings written out in
// full, so never build these by interpolation.
const KIND_LABELS: Record<FixedAssetTransferKind, string> = {
  location: "Location",
  custodian: "Custodian",
  entity: "Cross-entity",
};

const KIND_BADGE_VARIANTS: Record<FixedAssetTransferKind, BadgeVariant> = {
  location: "blue",
  custodian: "teal",
  entity: "violet",
};

const DESTINATION_LABELS: Record<FixedAssetTransferKind, string> = {
  location: "New location",
  custodian: "New custodian",
  entity: "Destination entity",
};

const CURRENT_LABELS: Record<FixedAssetTransferKind, string> = {
  location: "Currently at",
  custodian: "Currently held by",
  entity: "Currently owned by",
};

/**
 * Cross-entity approval is refused by the server today: completing one needs an
 * intercompany journal in each entity and no intercompany account role exists in
 * the chart of accounts. The request can still be raised and previewed, so say
 * so plainly rather than letting the user discover it at the approval step.
 */
const CROSS_ENTITY_NOTE =
  "A cross-entity move can be submitted and previewed, but it cannot be " +
  "approved yet — completing one posts an intercompany journal in each " +
  "entity and no intercompany account is configured in the chart of " +
  "accounts. The request stays pending until that lands. Location and " +
  "custodian transfers are unaffected.";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function entityLabel(entities: Entity[], id: string | null): string {
  if (!id) return "—";
  const match = entities.find((e) => e.id === id);
  return match ? `${match.name} (${match.code})` : id;
}

// ─── Submit dialog ──────────────────────────────────────────────────────────

const schema = z
  .object({
    kind: z.enum(FIXED_ASSET_TRANSFER_KINDS, {
      required_error: "Transfer kind is required",
    }),
    transferDate: z.string().min(1, "Transfer date is required"),
    toLocation: z.string(),
    toCustodian: z.string(),
    toEntityId: z.string(),
    reason: z.string().max(2000),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "location" && !v.toLocation.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toLocation"],
        message: "A destination location is required",
      });
    }
    if (v.kind === "custodian" && !v.toCustodian.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toCustodian"],
        message: "A destination custodian is required",
      });
    }
    if (v.kind === "entity" && !v.toEntityId.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toEntityId"],
        message: "A destination entity is required",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const EMPTY_FORM: FormValues = {
  kind: "location",
  transferDate: todayIso(),
  toLocation: "",
  toCustodian: "",
  toEntityId: "",
  reason: "",
};

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset | null;
  /**
   * Destination candidates for a cross-entity move. Optional so the dialog can
   * be mounted before the parent has loaded them; the entity kind then explains
   * that no destination is available instead of rendering an empty picker.
   */
  entities?: Entity[];
  onSaved: () => void;
}

export function FixedAssetTransferDialog({
  open,
  onOpenChange,
  asset,
  entities = [],
  onSaved,
}: TransferDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  // The submit response's plan is derived, not stored — render it as a preview.
  const [preview, setPreview] = useState<FixedAssetTransferSubmitResult | null>(
    null,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (open) {
      setPreview(null);
      form.reset({ ...EMPTY_FORM, transferDate: todayIso() });
    }
  }, [open, asset, form]);

  const kind = form.watch("kind");
  const isCrossEntity = kind === "entity";
  const destinationEntities = entities.filter((e) => e.id !== asset?.entityId);

  const currentValue = asset
    ? kind === "location"
      ? (asset.location ?? "—")
      : kind === "custodian"
        ? (asset.assignedUser ?? "—")
        : entityLabel(entities, asset.entityId)
    : "—";

  async function onSubmit(values: FormValues) {
    if (!asset) return;
    try {
      setSubmitting(true);
      const res = await submitFixedAssetTransfer(asset.id, {
        kind: values.kind,
        transferDate: values.transferDate,
        toLocation:
          values.kind === "location" ? values.toLocation.trim() : undefined,
        toCustodian:
          values.kind === "custodian" ? values.toCustodian.trim() : undefined,
        toEntityId: values.kind === "entity" ? values.toEntityId : undefined,
        reason: values.reason.trim() || null,
      });
      toast.success("Transfer submitted for approval");
      onSaved();
      if (res.data.movesValue) {
        // Cross-entity: keep the dialog open so the derived plan is actually
        // read — it is the only place the carried value is shown before the
        // (currently refused) approval.
        setPreview(res.data);
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      // The server's message is specific ("already at that location", "pending
      // disposal awaiting approval", …) — pass it through rather than flatten
      // it into a generic failure.
      toast.error(
        err instanceof ApiError ? err.message : "Failed to submit transfer",
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transfer asset</DialogTitle>
          <DialogDescription>
            {asset
              ? `${asset.assetNo} — ${asset.name}. A transfer needs approval; the asset only moves once it is approved.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="space-y-3">
            <div
              className={`
                border-border bg-surface space-y-2 rounded-md border px-3 py-3
                text-xs
              `}
            >
              <p
                className={`
                  text-muted-foreground text-[10px] font-semibold tracking-wider
                  uppercase
                `}
              >
                Planned movement
              </p>
              <p className="font-medium">{preview.summary}</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">Cost carried</dt>
                <dd className="text-right tabular-nums">
                  {preview.costTransferred
                    ? formatCurrency(preview.costTransferred)
                    : "—"}
                </dd>
                <dt className="text-muted-foreground">Accumulated carried</dt>
                <dd className="text-right tabular-nums">
                  {preview.accumulatedTransferred
                    ? formatCurrency(preview.accumulatedTransferred)
                    : "—"}
                </dd>
                <dt className="text-muted-foreground">Remaining life</dt>
                <dd className="text-right tabular-nums">
                  {preview.remainingLifeMonths === null
                    ? "—"
                    : `${preview.remainingLifeMonths} month(s)`}
                </dd>
                <dt className="text-muted-foreground">Destination entity</dt>
                <dd className="text-right">
                  {entityLabel(entities, preview.toEntityId)}
                </dd>
              </dl>
            </div>
            <div
              className={`
                border-warning/30 bg-warning/10 text-warning flex gap-2
                rounded-md border px-3 py-2 text-xs
              `}
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{CROSS_ENTITY_NOTE}</span>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form
              id="fa-transfer-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transfer kind</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FIXED_ASSET_TRANSFER_KINDS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {KIND_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Location and custodian are field moves. A cross-entity
                      move carries the asset at net book value and is the only
                      kind that touches the general ledger.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isCrossEntity ? (
                <div
                  className={`
                    border-warning/30 bg-warning/10 text-warning flex gap-2
                    rounded-md border px-3 py-2 text-xs
                  `}
                >
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{CROSS_ENTITY_NOTE}</span>
                </div>
              ) : null}

              <FormField
                control={form.control}
                name="transferDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transfer date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      A cross-entity move carries the accumulated depreciation
                      as at this date, not today&apos;s.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {kind === "location" ? (
                <FormField
                  control={form.control}
                  name="toLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{DESTINATION_LABELS.location}</FormLabel>
                      <div className="flex items-center gap-2">
                        <span
                          className={`
                            text-muted-foreground max-w-[38%] truncate text-xs
                          `}
                          title={currentValue}
                        >
                          {CURRENT_LABELS.location}: {currentValue}
                        </span>
                        <ArrowRight
                          className="text-muted-foreground size-3.5 shrink-0"
                          aria-hidden
                        />
                        <FormControl>
                          <Input placeholder="e.g. HQ — 3rd floor" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {kind === "custodian" ? (
                <FormField
                  control={form.control}
                  name="toCustodian"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{DESTINATION_LABELS.custodian}</FormLabel>
                      <div className="flex items-center gap-2">
                        <span
                          className={`
                            text-muted-foreground max-w-[38%] truncate text-xs
                          `}
                          title={currentValue}
                        >
                          {CURRENT_LABELS.custodian}: {currentValue}
                        </span>
                        <ArrowRight
                          className="text-muted-foreground size-3.5 shrink-0"
                          aria-hidden
                        />
                        <FormControl>
                          <Input placeholder="Custodian name" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {isCrossEntity ? (
                <FormField
                  control={form.control}
                  name="toEntityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{DESTINATION_LABELS.entity}</FormLabel>
                      <div className="flex items-center gap-2">
                        <span
                          className={`
                            text-muted-foreground max-w-[38%] truncate text-xs
                          `}
                          title={currentValue}
                        >
                          {CURRENT_LABELS.entity}: {currentValue}
                        </span>
                        <ArrowRight
                          className="text-muted-foreground size-3.5 shrink-0"
                          aria-hidden
                        />
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={destinationEntities.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Destination entity" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {destinationEntities.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.name} ({e.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {destinationEntities.length === 0 ? (
                        <FormDescription>
                          No other entity is available as a destination.
                        </FormDescription>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason / note</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        )}

        <DialogFooter>
          {preview ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          ) : (
            <>
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
                form="fa-transfer-form"
                disabled={submitting}
              >
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit for approval
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Approval queue ─────────────────────────────────────────────────────────

function destinationOf(t: FixedAssetTransfer, entities: Entity[]): string {
  if (t.kind === "location") return t.toLocation ?? "—";
  if (t.kind === "custodian") return t.toCustodian ?? "—";
  return entityLabel(entities, t.toEntityId);
}

function originOf(t: FixedAssetTransfer, entities: Entity[]): string {
  if (t.kind === "location") return t.fromLocation ?? "—";
  if (t.kind === "custodian") return t.fromCustodian ?? "—";
  return entityLabel(entities, t.asset?.entityId ?? t.entityId);
}

interface TransferQueueProps {
  entityId: string;
  canApprove: boolean;
  refreshKey: number;
  onActioned: () => void;
  /** Used to name the destination entity on a cross-entity row. */
  entities?: Entity[];
}

export function FixedAssetTransferQueue({
  entityId,
  canApprove,
  refreshKey,
  onActioned,
  entities = [],
}: TransferQueueProps) {
  const [rows, setRows] = useState<FixedAssetTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  // A cross-entity approval is refused with a specific, long explanation. A
  // toast truncates it, so the verbatim server message is also parked here and
  // rendered in full above the table.
  const [actionError, setActionError] = useState<{
    id: string;
    message: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      const res = await listFixedAssetTransfers({
        entityId,
        status: "pending",
      });
      setRows(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load transfers",
      );
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const approve = useCallback(
    async (t: FixedAssetTransfer) => {
      try {
        setActingId(t.id);
        setActionError(null);
        await approveFixedAssetTransfer(t.id);
        toast.success("Transfer approved");
        await load();
        onActioned();
      } catch (err) {
        if (err instanceof ApiError) {
          // Verbatim — the cross-entity refusal explains exactly what is
          // missing and that the request stays pending. Do not paraphrase.
          setActionError({ id: t.id, message: err.message });
          toast.error(err.message, { duration: 10000 });
        } else {
          setActionError({ id: t.id, message: "Failed to approve transfer" });
          toast.error("Failed to approve transfer");
        }
      } finally {
        setActingId(null);
      }
    },
    [load, onActioned],
  );

  const reject = useCallback(
    async (t: FixedAssetTransfer) => {
      const reason = window.prompt("Reason for rejecting this transfer?");
      if (reason === null) return;
      if (!reason.trim()) {
        toast.error("A rejection reason is required");
        return;
      }
      try {
        setActingId(t.id);
        setActionError(null);
        await rejectFixedAssetTransfer(t.id, reason.trim());
        toast.success("Transfer rejected");
        await load();
        onActioned();
      } catch (err) {
        if (err instanceof ApiError) {
          setActionError({ id: t.id, message: err.message });
          toast.error(err.message, { duration: 10000 });
        } else {
          setActionError({ id: t.id, message: "Failed to reject transfer" });
          toast.error("Failed to reject transfer");
        }
      } finally {
        setActingId(null);
      }
    },
    [load, onActioned],
  );

  if (!loading && rows.length === 0 && !actionError) return null;

  const columns = [
    {
      key: "asset",
      mobileRole: "title" as const,
      header: "Asset",
      render: (t: FixedAssetTransfer) => (
        <div>
          <div className="font-medium">{t.asset?.assetNo ?? "—"}</div>
          <div className="text-muted-foreground text-xs">
            {t.asset?.categoryCode}
          </div>
        </div>
      ),
    },
    {
      key: "kind",
      mobileRole: "subtitle" as const,
      header: "Kind",
      render: (t: FixedAssetTransfer) => (
        <Badge variant={KIND_BADGE_VARIANTS[t.kind]}>
          {KIND_LABELS[t.kind]}
        </Badge>
      ),
    },
    {
      key: "transferDate",
      mobileRole: "field" as const,
      header: "Date",
      render: (t: FixedAssetTransfer) => (
        <span className="tabular-nums">{formatDate(t.transferDate)}</span>
      ),
    },
    {
      key: "movement",
      mobileRole: "field" as const,
      header: "Movement",
      render: (t: FixedAssetTransfer) => (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground max-w-[140px] truncate">
            {originOf(t, entities)}
          </span>
          <ArrowRight className="text-muted-foreground size-3 shrink-0" />
          <span className="max-w-[160px] truncate">
            {destinationOf(t, entities)}
          </span>
        </div>
      ),
    },
    {
      key: "costTransferred",
      mobileRole: "detail" as const,
      header: "Cost carried",
      className: "text-right",
      render: (t: FixedAssetTransfer) => (
        <span className="tabular-nums">
          {t.costTransferred ? formatCurrency(t.costTransferred) : "—"}
        </span>
      ),
    },
    {
      key: "accumulatedTransferred",
      mobileRole: "detail" as const,
      header: "Accum. carried",
      className: "text-right",
      render: (t: FixedAssetTransfer) => (
        <span className="tabular-nums">
          {t.accumulatedTransferred
            ? formatCurrency(t.accumulatedTransferred)
            : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      mobileRole: "actions" as const,
      header: "",
      className: "w-28 text-right",
      render: (t: FixedAssetTransfer) => {
        if (!canApprove) return null;
        const busy = actingId === t.id;
        return (
          <div className="inline-flex items-center gap-1">
            {actionError?.id === t.id ? (
              <AlertTriangle
                className="text-warning size-3.5"
                aria-label="Approval refused"
              />
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              onClick={() => void approve(t)}
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
              onClick={() => void reject(t)}
              aria-label="Reject"
            >
              <X className="text-destructive size-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <section className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="border-border border-b px-5 py-3">
        <p
          className={`
            text-muted-foreground text-[10px] font-semibold tracking-wider
            uppercase
          `}
        >
          Pending transfer approvals
        </p>
      </div>

      {actionError ? (
        <div
          className={`
            border-warning/30 bg-warning/10 text-warning m-4 flex gap-2
            rounded-md border px-3 py-2 text-xs
          `}
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold">The server refused this action</p>
            <p>{actionError.message}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setActionError(null)}
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        emptyMessage="No pending transfers"
      />
    </section>
  );
}

// ─── Per-asset movement history ─────────────────────────────────────────────

const HISTORY_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

interface MovementHistoryProps {
  assetId: string;
  /** Bump to re-fetch after a submit / approval elsewhere on the page. */
  refreshKey?: number;
  entities?: Entity[];
}

export function FixedAssetMovementHistory({
  assetId,
  refreshKey = 0,
  entities = [],
}: MovementHistoryProps) {
  const [rows, setRows] = useState<FixedAssetTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!assetId) return;
    try {
      setLoading(true);
      const res = await listFixedAssetTransfersForAsset(assetId);
      setRows(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load the movement history",
      );
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const columns = [
    {
      key: "transferDate",
      mobileRole: "title" as const,
      header: "Date",
      render: (t: FixedAssetTransfer) => (
        <span className="tabular-nums">{formatDate(t.transferDate)}</span>
      ),
    },
    {
      key: "kind",
      mobileRole: "subtitle" as const,
      header: "Kind",
      render: (t: FixedAssetTransfer) => (
        <Badge variant={KIND_BADGE_VARIANTS[t.kind]}>
          {KIND_LABELS[t.kind]}
        </Badge>
      ),
    },
    {
      key: "movement",
      mobileRole: "field" as const,
      header: "Movement",
      render: (t: FixedAssetTransfer) => (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground max-w-[140px] truncate">
            {originOf(t, entities)}
          </span>
          <ArrowRight className="text-muted-foreground size-3 shrink-0" />
          <span className="max-w-[160px] truncate">
            {destinationOf(t, entities)}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      mobileRole: "badge" as const,
      header: "Status",
      render: (t: FixedAssetTransfer) => (
        <Badge status={t.status}>
          {HISTORY_STATUS_LABELS[t.status] ?? t.status}
        </Badge>
      ),
    },
    {
      key: "reason",
      mobileRole: "detail" as const,
      header: "Reason",
      render: (t: FixedAssetTransfer) => (
        <span className="text-muted-foreground text-xs">
          {t.status === "rejected"
            ? (t.rejectReason ?? "—")
            : (t.reason ?? "—")}
        </span>
      ),
    },
  ];

  return (
    <section className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="border-border border-b px-5 py-3">
        <p
          className={`
            text-muted-foreground text-[10px] font-semibold tracking-wider
            uppercase
          `}
        >
          Movement history
        </p>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        skeletonRows={3}
        emptyMessage="No transfers recorded for this asset"
      />
    </section>
  );
}
