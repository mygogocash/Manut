"use client";

import { ArrowLeftRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  listVendorDuplicateSuggestions,
  mergeVendors,
  previewVendorMerge,
  type VendorDuplicateGroup,
  type VendorDuplicateVendor,
  type VendorMergePreview,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

interface VendorMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  defaultEntityId?: string;
  onMerged: () => void;
}

const money = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// "45,000.00 + 120,000.00 = 165,000.00" for one control account. AR and AP are
// rendered as separate lines because the merge checks them separately — a
// combined figure would hide a drift on one side behind the other.
const formatOutstanding = (source: number, surviving: number) =>
  `${money(source)} + ${money(surviving)} = ${money(source + surviving)}`;

export function VendorMergeDialog({
  open,
  onOpenChange,
  entities,
  defaultEntityId,
  onMerged,
}: VendorMergeDialogProps) {
  const [entityId, setEntityId] = useState("");
  const [groups, setGroups] = useState<VendorDuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [survivingId, setSurvivingId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [missingTaxIdReason, setMissingTaxIdReason] = useState("");
  const [sameParty, setSameParty] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [merging, setMerging] = useState(false);
  const [preview, setPreview] = useState<VendorMergePreview | null>(null);
  const [keepFields, setKeepFields] = useState<
    Record<string, "surviving" | "source">
  >({});

  useEffect(() => {
    if (!open) return;
    setEntityId(defaultEntityId ?? "");
    setGroups([]);
    setSurvivingId("");
    setSourceId("");
    setMissingTaxIdReason("");
    setConfirmed(false);
    setPreview(null);
    setKeepFields({});
  }, [defaultEntityId, open]);

  useEffect(() => {
    if (!open) return;
    if (!entityId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listVendorDuplicateSuggestions({ entityId })
      .then((res) => {
        if (!cancelled) setGroups(res.data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setGroups([]);
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Failed to load duplicate suggestions",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityId, open]);

  const vendorsById = useMemo(() => {
    const map = new Map<string, VendorDuplicateVendor>();
    for (const group of groups) {
      for (const vendor of group) {
        map.set(vendor.id, vendor);
      }
    }
    return map;
  }, [groups]);

  const surviving = vendorsById.get(survivingId) ?? null;
  const source = vendorsById.get(sourceId) ?? null;

  useEffect(() => {
    if (!open || !survivingId || !sourceId || survivingId === sourceId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    previewVendorMerge({
      survivingVendorId: survivingId,
      sourceVendorId: sourceId,
    })
      .then((res) => {
        if (cancelled) return;
        setPreview(res.data);
        const next: Record<string, "surviving" | "source"> = {};
        for (const field of res.data.fields) {
          next[field.field] = "surviving";
        }
        setKeepFields(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreview(null);
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Failed to load merge preview",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [open, survivingId, sourceId]);

  const taxIdNeedsReason = useMemo(() => {
    if (!surviving || !source) return false;
    const a = surviving.taxId?.trim() ?? "";
    const b = source.taxId?.trim() ?? "";
    return !a || !b || a !== b;
  }, [source, surviving]);

  function assignRole(vendorId: string, role: "survivor" | "source") {
    if (role === "survivor") {
      setSurvivingId(vendorId);
      if (sourceId === vendorId) setSourceId("");
      return;
    }
    setSourceId(vendorId);
    if (survivingId === vendorId) setSurvivingId("");
  }

  function swapRoles() {
    setSurvivingId(sourceId);
    setSourceId(survivingId);
  }

  async function handleMerge() {
    if (!surviving || !source || surviving.id === source.id) return;
    if (preview?.blocked) {
      toast.error(preview.blocked);
      return;
    }
    if (taxIdNeedsReason && !sameParty) {
      toast.error("Confirm these are the same party before merging");
      return;
    }
    if (taxIdNeedsReason && !missingTaxIdReason.trim()) {
      toast.error("A missing or mismatched tax ID requires a reason");
      return;
    }
    if (!confirmed) {
      toast.error("Confirm that this merge cannot be undone");
      return;
    }
    try {
      setMerging(true);
      const res = await mergeVendors({
        survivingVendorId: surviving.id,
        sourceVendorId: source.id,
        acknowledgedSameParty: taxIdNeedsReason ? sameParty : undefined,
        missingTaxIdReason: taxIdNeedsReason
          ? missingTaxIdReason.trim()
          : undefined,
        keepFields,
      });
      toast.success("Vendors merged. The source vendor is deactivated.");
      if (res.data.warning) toast.warning(res.data.warning);
      const dups = res.data.duplicatePayments?.length ?? 0;
      if (dups > 0) {
        toast.warning(
          `Possible duplicate payments after merge: ${dups} group(s). Review Payments.`,
        );
      }
      onMerged();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to merge vendors",
      );
    } finally {
      setMerging(false);
    }
  }

  const canSubmit =
    Boolean(surviving && source && surviving.id !== source.id && confirmed) &&
    !preview?.blocked &&
    (!taxIdNeedsReason || (Boolean(missingTaxIdReason.trim()) && sameParty)) &&
    !merging;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Merge duplicate vendors</DialogTitle>
          <DialogDescription>
            Documents move to the surviving vendor. The source is deactivated.
            This cannot be undone and does not post GL entries.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div>
            <Label htmlFor="vendor-merge-entity">Entity</Label>
            <Select
              value={entityId}
              onValueChange={(value) => {
                setEntityId(value);
                setSurvivingId("");
                setSourceId("");
                setMissingTaxIdReason("");
                setConfirmed(false);
              }}
            >
              <SelectTrigger id="vendor-merge-entity" className="h-10 text-xs">
                <SelectValue placeholder="Select entity" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.code} · {entity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!entityId ? (
            <p className="text-muted-foreground text-xs">
              Choose an entity to load duplicate suggestions (same tax ID).
            </p>
          ) : loading ? (
            <div
              className={`
                text-muted-foreground flex items-center justify-center gap-2
                py-8 text-xs
              `}
            >
              <Loader2 className="size-3.5 animate-spin" />
              Loading suggestions
            </div>
          ) : groups.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No duplicate tax-ID groups for this entity.
            </p>
          ) : (
            <Table containerClassName="max-h-56 overflow-auto rounded-md border">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Tax ID</TableHead>
                  <TableHead className="text-right">Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => {
                  const groupKey = group.map((v) => v.id).join(":");
                  return (
                    <GroupRows
                      key={groupKey}
                      group={group}
                      survivingId={survivingId}
                      sourceId={sourceId}
                      onAssign={assignRole}
                    />
                  );
                })}
              </TableBody>
            </Table>
          )}

          {surviving && source ? (
            <div
              className={`
                grid gap-2
                sm:grid-cols-[1fr_auto_1fr] sm:items-stretch
              `}
            >
              <VendorCard
                label="Survivor (kept)"
                vendor={surviving}
                entity={entities.find((e) => e.id === surviving.entityId)}
              />
              <div className="flex items-center justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={swapRoles}
                  aria-label="Swap survivor and source"
                >
                  <ArrowLeftRight className="size-3.5" />
                </Button>
              </div>
              <VendorCard
                label="Source (merged away)"
                vendor={source}
                entity={entities.find((e) => e.id === source.entityId)}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              Select one survivor and one source from the suggestions.
            </p>
          )}

          {preview ? (
            <div className="grid gap-2 rounded-md border p-3 text-xs">
              <p className="font-medium">
                Documents moving: {preview.documents.invoices} bills,{" "}
                {preview.documents.payments} payments,{" "}
                {preview.documents.creditNotes} credit notes,{" "}
                {preview.documents.quotes} quotes,{" "}
                {preview.documents.purchaseOrders} POs.
              </p>
              <p>
                Outstanding receivable{" "}
                {formatOutstanding(
                  preview.outstanding.source.receivable,
                  preview.outstanding.surviving.receivable,
                )}{" "}
                and payable{" "}
                {formatOutstanding(
                  preview.outstanding.source.payable,
                  preview.outstanding.surviving.payable,
                )}{" "}
                must each still match after the merge.
              </p>
              {preview.fields.filter((f) => f.different).length > 0 ? (
                <Table containerClassName="max-h-40 overflow-auto">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      <TableHead>Keep</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.fields
                      .filter((f) => f.different)
                      .map((f) => (
                        <TableRow key={f.field}>
                          <TableCell className="whitespace-normal">
                            <span className="font-medium">{f.field}</span>
                            <p className="text-muted-foreground mt-0.5">
                              Survivor: {String(f.surviving ?? "—")} · Source:{" "}
                              {String(f.source ?? "—")}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={keepFields[f.field] ?? "surviving"}
                              onValueChange={(value) =>
                                setKeepFields((prev) => ({
                                  ...prev,
                                  [f.field]: value as "surviving" | "source",
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="surviving">
                                  Survivor
                                </SelectItem>
                                <SelectItem value="source">Source</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">
                  Master fields match; only document ownership moves.
                </p>
              )}
            </div>
          ) : null}

          {taxIdNeedsReason ? (
            <div>
              <Label htmlFor="vendor-merge-reason">
                Reason (required when a tax ID is missing or the two tax IDs
                differ)
              </Label>
              <Textarea
                id="vendor-merge-reason"
                value={missingTaxIdReason}
                onChange={(event) => setMissingTaxIdReason(event.target.value)}
                maxLength={1000}
                rows={3}
                className="text-xs"
              />
            </div>
          ) : null}

          {preview?.blocked ? (
            <p
              className={`
                border-destructive/50 bg-destructive/5 rounded-md border p-3
                text-xs font-medium
              `}
              role="alert"
            >
              Cannot merge: {preview.blocked}
            </p>
          ) : null}

          {preview && preview.requiresTaxIdReason && !preview.blocked ? (
            <div className="grid gap-2 rounded-md border p-3 text-xs">
              <p className="font-medium">
                No tax ID on one side — {preview.identity.score} of{" "}
                {preview.identity.required} identifiers agree
              </p>
              <ul className="grid gap-1">
                {preview.identity.matches.map((m) => (
                  <li key={m.component}>
                    {m.matched ? "✓" : "✗"} {m.detail}
                  </li>
                ))}
              </ul>
              <label className="mt-1 flex items-start gap-2 font-medium">
                <Checkbox
                  checked={sameParty}
                  onCheckedChange={(checked) => setSameParty(checked === true)}
                  aria-label="Confirm these are the same party"
                />
                <span>
                  I have checked these are the same party. Merging the wrong two
                  pools their withholding tax, so certificates and PND3 filings
                  already submitted stop matching the real payee.
                </span>
              </label>
            </div>
          ) : null}

          <label className="flex items-start gap-2 text-xs">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
              aria-label="Confirm irreversible merge"
            />
            <span>
              I understand this merge is irreversible. Receivable, payable and
              advance balances on the combined contact must each match or the
              API will roll the whole thing back.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={merging}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canSubmit}
            onClick={() => void handleMerge()}
            className="min-w-32"
          >
            {merging ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Merge vendors
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GroupRows({
  group,
  survivingId,
  sourceId,
  onAssign,
}: {
  group: VendorDuplicateGroup;
  survivingId: string;
  sourceId: string;
  onAssign: (vendorId: string, role: "survivor" | "source") => void;
}) {
  const taxId = group[0]?.taxId?.trim() || "No tax ID";
  return (
    <>
      <TableRow className="hover:bg-transparent">
        <TableCell
          colSpan={3}
          className={`
            bg-muted/40 text-muted-foreground text-[10px] font-semibold
            tracking-wider uppercase
          `}
        >
          Same tax ID · {taxId} · {group.length} vendors
        </TableCell>
      </TableRow>
      {group.map((vendor) => {
        const isSurvivor = vendor.id === survivingId;
        const isSource = vendor.id === sourceId;
        return (
          <TableRow
            key={vendor.id}
            data-state={isSurvivor || isSource ? "selected" : undefined}
          >
            <TableCell className="text-xs font-medium whitespace-normal">
              {vendor.name}
            </TableCell>
            <TableCell className="font-mono text-[11px]">
              {vendor.taxId?.trim() ? vendor.taxId : "—"}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={isSurvivor ? "default" : "outline"}
                  className="h-7 px-2 text-[11px]"
                  onClick={() => onAssign(vendor.id, "survivor")}
                >
                  Survivor
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={isSource ? "default" : "outline"}
                  className="h-7 px-2 text-[11px]"
                  onClick={() => onAssign(vendor.id, "source")}
                >
                  Source
                </Button>
              </div>
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}

function VendorCard({
  label,
  vendor,
  entity,
}: {
  label: string;
  vendor: VendorDuplicateVendor;
  entity?: Entity;
}) {
  return (
    <div className="border-border bg-muted/20 rounded-lg border p-3">
      <p
        className={`
          text-muted-foreground text-[10px] font-semibold tracking-wider
          uppercase
        `}
      >
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{vendor.name}</p>
      <p className="text-muted-foreground mt-1 font-mono text-[11px]">
        Tax ID {vendor.taxId?.trim() ? vendor.taxId : "missing"}
      </p>
      {entity ? (
        <Badge variant="blue" className="mt-2">
          {entity.code}
        </Badge>
      ) : null}
    </div>
  );
}
